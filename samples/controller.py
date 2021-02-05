import time
import numpy as np

# replace the filename below with the path to your robots pins.dat 
# if your controller is not being run from the same folder as the 
# simulator

pins = np.memmap("bots/001/pins.dat", dtype=np.uint32, mode="r+", shape=(41,))


def analogRead(pin):
    return pins[pin]

def analogWrite(pin, value):
    if value < 0 or value > 1023:
        raise ValueError
    pins[pin] = value

def digitalRead(pin):
    return pins[pin]

def digitalWrite(pin, value):
    if value not in (0, 1):
        raise ValueError
    pins[pin] = value


def loop():
    # read sensor values
    right_sensor = analogRead(8)
    # TODO: insert code to read remaining sensors

    # TODO: respond to sensor values
    
    # drive forward
    digitalWrite(37, 1)
    analogWrite(38, 200)
    digitalWrite(39, 1)
    analogWrite(40, 200)


# main loop
while True:
    loop()

    # sleep for 50 ms
    time.sleep(50 / 1000)