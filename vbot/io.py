import numpy as np
from pathlib import Path


LOW, HIGH = 0, 1


pins = None


def open_pinfile(filename="pins.dat"):
    global pins
    if pins is None:
        pinfile = Path(filename)
        mode = "w+"
        if pinfile.exists():
            mode = "r+"
        pins = np.memmap(filename, dtype=np.uint32, mode=mode, shape=(41,))
    return pins


def check_valid_pin(pin):
    if pin < 0:
        raise ValueError("negative pin index")
    if pin > pins.shape[0]:
        raise ValueError("pin index out of range")


def digital_write(pin, value):
    check_valid_pin(pin)
    if value not in (HIGH, LOW):
        raise ValueError("bad digital write value")
    pins[pin] = value
    # pins.flush()


def digital_read(pin):
    check_valid_pin(pin)
    return 0 if pins[pin] == 0 else 1


def analog_write(pin, value):
    check_valid_pin(pin)
    if value < 0:
        raise ValueError("bad analog write value (<0)")
    if value > 1023:
        raise ValueError("bad analog write value (>1023)")
    pins[pin] = value
    # pins.flush()


def analog_read(pin):
    check_valid_pin(pin)
    return pins[pin]


