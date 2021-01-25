import numpy as np

from pathlib import Path
from PIL import Image

from .io import open_pinfile
from .io import HIGH, LOW
from .io import digital_read, digital_write
from .io import analog_read, analog_write
from .state import BotState


class Sensor(object):
    def __init__(self, pin, name="Sensor", offset=(0,0)):
        self.pin = pin
        self.name = name
        self.offset = np.array(offset, dtype=np.float64)

    def reset(self):
        self.value = 0

    @property
    def value(self):
        return analog_read(self.pin)

    @value.setter
    def value(self, val):
        analog_write(self.pin, val)

    def __repr__(self):
        return f"{self.name}({self.value})"

    def __str__(self):
        return repr(self)


class Motor(object):
    def __init__(self, phase_pin, pwm_pin, name="Motor"):
        self.name = name
        self.phase_pin = phase_pin
        self.pwm_pin = pwm_pin

    def reset(self):
        self.phase = HIGH
        self.pwm = 0

    @property
    def phase(self):
        return digital_read(self.phase_pin)

    @phase.setter
    def phase(self, val):
        digital_write(self.phase_pin, val)

    @property
    def pwm(self):
        return analog_read(self.pwm_pin)
    
    @pwm.setter
    def pwm(self, val):
        analog_write(self.pwm_pin, val)

    def __repr__(self):
        return f"{self.name}(phase={self.phase}, pwm={self.pwm})"

    def __str__(self):
        return repr(self)


class Pin:
    leftPhase = 37
    leftPWM = 38
    rightPhase = 39
    rightPWM = 40
    opticalLL = 14
    opticalL = 13
    opticalC = 11
    opticalR = 9
    opticalRR = 8
    distanceSensor = 1


class Robot(object):
    def __init__(self):

        # setup sensors
        self.left_wheel = Motor(Pin.leftPhase, Pin.leftPWM, "LeftWheel")
        self.right_wheel = Motor(Pin.rightPhase, Pin.rightPWM, "RightWheel")
        self.optical_sensors = [
            Sensor(Pin.opticalLL, "LeftMostOptical", (45, -32)),
            Sensor(Pin.opticalL, "LeftOptical", (45, -16)),
            Sensor(Pin.opticalC, "CenterOptical", (45, 0)),
            Sensor(Pin.opticalR, "RightOptical", (45, 16)),
            Sensor(Pin.opticalRR, "RightMostOptical", (45, 32)),
        ]
        self.distance_sensor = Sensor(Pin.distanceSensor, "DistanceSensor")

        # state
        self.position = np.array([540, 470], dtype=np.float64)
        self.orientation = 0

        self.sprite = Image.open("res/robot.png")

    def reset(self):
        self.position = np.array([540, 470], dtype=np.float64)
        self.orientation = 0
        self.left_wheel.reset()
        self.right_wheel.reset()
        for sensor in self.optical_sensors:
            sensor.reset()
        self.distance_sensor.reset()


class Simulation(object):
    def __init__(self, path):
        self.path = path
        self.state = BotState(path / "state.dat")
        self.track = Image.open("res/track.png")
        self.robot = Robot()
        self.velocity_multiplier = 0.01
        self.wheel_distance = 90

    def reset(self):
        self.robot.reset()

    def sense(self):
        track_data = np.array(self.track)
        translation = self.robot.position
        theta = self.robot.orientation 
        rotation = np.array([
            [np.cos(theta), -np.sin(theta)],
            [np.sin(theta), np.cos(theta)]
        ])

        # update values on the optical sensor pins
        for sensor in self.robot.optical_sensors:
            location = rotation @ sensor.offset + translation
            clip_position(location, self.track.size, 1)
            x, y = location
            i = int(y)
            j = int(x)
            value = track_data[i, j]
            sensor.value = value

        # update the distance sensor
        dist = distance_to_walls(translation, theta, self.track.size)
        dist = int(dist)
        if dist > 1023:
            dist = 1023
        self.robot.distance_sensor.value = dist


    def actuate(self):

        # left wheel velocity
        l_pwm = float(self.robot.left_wheel.pwm)
        v_l = l_pwm
        if self.robot.left_wheel.phase == LOW:
            v_l = -v_l
        v_l *= self.velocity_multiplier
        
        # right wheel velocity
        r_pwm = float(self.robot.right_wheel.pwm)
        v_r = r_pwm
        if self.robot.right_wheel.phase == LOW:
            v_r = -v_r
        v_r *= self.velocity_multiplier
  
        # instantateous linear velocity
        linear_v = 0.5 * (v_l + v_r)

        # angular velocity
        angular_v = (v_r - v_l) / self.wheel_distance

        # robot velocity
        v_robot = np.array([
            linear_v * np.cos(self.robot.orientation),
            linear_v * np.sin(self.robot.orientation)
        ])

        # t + delta t
        self.robot.position += v_robot
        self.robot.orientation = (self.robot.orientation + angular_v) % (2*np.pi)

        # stay inside track
        clip_position(self.robot.position, self.track.size, 32)

        # persist state
        self.state.position = self.robot.position
        self.state.orientation = self.robot.orientation

    def tick(self):
        self.actuate()
        self.sense()


def clip_position(position, size, radius):
    w, h = size
    if position[0] < radius:
        position[0] = radius
    if position[1] < radius:
        position[1] = radius
    if position[0] > w - radius:
        position[0] = w - radius
    if position[1] > h - radius:
        position[1] = h - radius


def distance_to_walls(location, orientation, size):
    # location of robot
    x, y = location

    # directional vector and corresponding length
    w = np.array([np.cos(orientation), np.sin(orientation)])
    norm_w = np.linalg.norm(w)

    # perpindicular distance to walls
    p_dist_left = x
    p_dist_right = size[0] - x
    p_dist_top = y
    p_dist_bottom = size[1] - y

    # directional distance to walls
    d_dist_left = -p_dist_left * norm_w / w[0] if w[0] != 0 else np.inf
    d_dist_right =  p_dist_right * norm_w / w[0]  if w[0] != 0 else np.inf
    d_dist_top = -p_dist_top * norm_w / w[1] if w[1] != 0 else np.inf
    d_dist_bottom = p_dist_bottom * norm_w / w[1] if w[1] != 0 else np.inf
    dists = np.array([d_dist_left, d_dist_right, d_dist_top, d_dist_bottom])

    # forward distance only!
    dists[dists<0] = np.inf

    # shortest distance
    return dists.min()