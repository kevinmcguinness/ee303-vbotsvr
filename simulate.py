import click
import time
import os
import sys
import atexit
import signal

from pathlib import Path
from vbot.bot import Simulation
from vbot.io import open_pinfile

arg = click.argument
opt = click.option





@click.command()
@opt("--root", type=str, default="bots")
@opt("--bot-id", type=str, default="001")
@opt("--timeout", type=int, default=5*60)
def main(root, bot_id, timeout):

    # data path
    path = Path(root)
    if not path.exists():
        path.mkdir()

    path = path / bot_id
    if not path.exists():
        path.mkdir()


    # check if proc is running
    pidfile = path / 'pid'
    if pidfile.exists():
        print(f"pid file exists: {pidfile}", file=sys.stderr, flush=True)
        sys.exit(1)

    # create pid file
    pid = os.getpid()
    with open(pidfile, 'w') as f:
        print(pid, file=f)

    # delete pidfile on exit
    def remove_pidfile():
        print("removing pidfile")
        if pidfile.exists():
            pidfile.unlink()
    atexit.register(remove_pidfile)

    # delete pidfile if killed
    def on_kill(*args):
        print("on kill")
        remove_pidfile()
        sys.exit(0)

    # install signal handlers
    signal.signal(signal.SIGINT, on_kill)
    signal.signal(signal.SIGTERM, on_kill) 
    signal.signal(signal.SIGABRT, on_kill) 

    open_pinfile(path / "pins.dat")
    simulation = Simulation(path)
    simulation.reset()

    start_time = time.time()

    # main loop
    while True:
        simulation.tick()
        time.sleep(50 / 1000)

        # terminate if timeout elapses
        elapsed_time = time.time() - start_time
        if elapsed_time > timeout:
            break

        # terminate if pidfile is removed
        if not pidfile.exists():
            break
    
    print("exiting...")



if __name__ == "__main__":
    main()  # pylint: disable=no-value-for-parameter 