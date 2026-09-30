#pragma once
#include <string>
#include <sstream>
#include <vector>
#include <array>
#define LED_B 23
#define LED_G 24
#define HIGH 1
#define LOW 0
#define OUTPUT 1
inline int pins[32] = {};
inline unsigned long nowMs = 0;
inline std::vector<std::array<int, 3>> intervals;
inline void delay(unsigned long duration) {
  intervals.push_back({pins[LED_B], pins[LED_G], static_cast<int>(duration)});
  nowMs += duration;
}
inline unsigned long millis() { return nowMs; }
inline void pinMode(int, int) {}
inline void digitalWrite(int pin, int value) { pins[pin] = value; }
inline int digitalRead(int pin) { return pins[pin]; }
struct SerialMock {
  std::string input, output;
  void begin(int) {}
  int available() { return input.size(); }
  char read() { char c = input[0]; input.erase(0,1); return c; }
  template<typename T> void print(T value) { std::ostringstream s; s << value; output += s.str(); }
  template<typename T> void println(T value) { print(value); output += '\n'; }
};
inline SerialMock Serial;
