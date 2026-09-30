#include <cassert>
#include <iostream>
#include "../firmware/VoiceLED/VoiceLED.ino"
void feed(const std::string& text) { Serial.input += text; loop(); }
int main() {
  setup(); assert(!pins[23] && !pins[24]);
  feed("V1 1 BLUE_ON\n"); assert(pins[23] && !pins[24]);
  assert(Serial.output.find("\"id\":1,\"ok\":true,\"blue\":true,\"green\":false") != std::string::npos);
  feed("V1 2 GREEN_ON\n"); assert(pins[23] && pins[24]);
  for (auto text : {"V1 3 BLUE_OFF garbage\n", "V1 0 BLUE_OFF\n", "V1 -1 BLUE_OFF\n", "V1 1234567890 BLUE_OFF\n", "V1 4 BLUE_\rOFF\n", "V2 1 BLUE_OFF\n"}) {
    feed(text); assert(pins[23] && pins[24]);
  }
  feed(std::string(120,'x') + "V1 5 BLUE_OFF\n"); assert(pins[23]);
  feed("V1 6 BLUE_"); nowMs += 1001; loop(); feed("OFF\n"); assert(pins[23]);
  feed("V1 7 BLUE_OFF\r"); feed("\n"); assert(!pins[23] && pins[24]);
  feed("V1 8 GREEN_OFF\n"); assert(!pins[23] && !pins[24]);
  feed("V1 9 STATUS\n"); assert(!pins[23] && !pins[24]);
  for (auto command : {"BLUE_BLINK3", "GREEN_BLINK3", "BOTH_BLINK3"}) {
    for (int blue = 0; blue <= 1; ++blue) for (int green = 0; green <= 1; ++green) {
      pins[23] = blue; pins[24] = green; intervals.clear(); Serial.output.clear();
      feed(std::string("V1 10 ") + command + "\n");
      assert(pins[23] == blue && pins[24] == green);
      assert(intervals.size() == 7);
      for (size_t i = 0; i < intervals.size(); ++i) {
        const bool high = i % 2 == 1;
        assert(intervals[i][0] == (std::string(command) == "GREEN_BLINK3" ? blue : high));
        assert(intervals[i][1] == (std::string(command) == "BLUE_BLINK3" ? green : high));
        assert(intervals[i][2] == 250);
      }
      assert(Serial.output.find("\"id\":10,\"ok\":true") != std::string::npos);
    }
  }
  intervals.clear(); feed("V1 11 BLUE_BLINK3 garbage\n"); assert(intervals.empty());
  std::cout << "PASS: firmware commands, ACK, invalid IDs, malformed, overflow, timeout, split CRLF, status\n";
}
