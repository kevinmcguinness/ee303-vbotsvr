/*
 * Command to compile on Windows using Visual C++ Terminal:
 * 
 * cl /EHsc /MD /I C:\boost_1_75_0 samples/controller.cpp /link /LIBPATH:C:\boost\lib 
 * 
 */


#include <stdexcept>
#include <thread>
#include <chrono>
#include <iostream>

#include <boost/interprocess/file_mapping.hpp>
#include <boost/interprocess/mapped_region.hpp>


namespace ipc = boost::interprocess;


uint32_t* pins;


void analogWrite(int pin, int value) {
    if (value < 0 || value > 1024) {
        throw std::invalid_argument("invalid value");
    }
    pins[pin] = value;
}

void digitalWrite(int pin, int value) {
    if (value != 0 && value != 1) {
        throw std::invalid_argument("invalid value");
    }
    pins[pin] = value;
}

int analogRead(int pin) {
    return pins[pin];
}

int digitalRead(int pin) {
    return pins[pin];
}

void loop() {
    int value = analogRead(8);
    // ...

    // go forward
    digitalWrite(37, 1);
    analogWrite(38, 200);
    digitalWrite(39, 1);
    analogWrite(40, 200);
}

int main() {
    using namespace std;

    try {

        // load memory mapped file
        ipc::file_mapping file("bots/001/pins.dat", ipc::read_write);
        ipc::mapped_region region(file, ipc::read_write);
        pins = (uint32_t*) region.get_address();

        cout << "main loop" << endl;
        while (true) {
            loop();
            this_thread::sleep_for(chrono::milliseconds(50));
        }

    } catch (exception& e) {
        cout << "Error: " << e.what() << endl;
        return 1;
    }

    return 0;
}
