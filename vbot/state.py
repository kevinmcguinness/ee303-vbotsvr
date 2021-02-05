import numpy as np
from pathlib import Path


class BotState(object):
    def __init__(self, filename):
        path = Path(filename)
        mode = "w+"
        if path.exists():
            mode = "r+"
        self._mem = np.memmap(filename, dtype=np.float64, mode=mode, shape=(3,))

    @property
    def position(self):
        x = self._mem[0]
        y = self._mem[1]
        return x, y

    @position.setter
    def position(self, loc):
        x, y = loc
        self._mem[0] = x
        self._mem[1] = y
    
    @property
    def orientation(self):
        return self._mem[2]
    
    @orientation.setter
    def orientation(self, val):
        self._mem[2] = val

    def __repr__(self):
        return str(self._mem)
    