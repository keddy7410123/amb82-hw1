#include <Arduino.h>
#include <stdlib.h>
#include <string.h>

// AMB82-MINI / RTL8735B: LED_B = D23/PF9, LED_G = D24/PE6.
static_assert(LED_B == 23 && LED_G == 24, "Select AMB82-MINI");
char lineBuffer[96];
size_t used = 0;
bool discardLine = false;
bool sawCR = false;
unsigned long lastByte = 0;

void blinkThree(bool blue, bool green) {
  const int previousBlue = digitalRead(LED_B);
  const int previousGreen = digitalRead(LED_G);
  // Establish a dark interval so an already-lit LED also has three visible pulses.
  if (blue) digitalWrite(LED_B, LOW);
  if (green) digitalWrite(LED_G, LOW);
  delay(250);
  for (int i = 0; i < 3; ++i) {
    if (blue) digitalWrite(LED_B, HIGH);
    if (green) digitalWrite(LED_G, HIGH);
    delay(250);
    if (blue) digitalWrite(LED_B, LOW);
    if (green) digitalWrite(LED_G, LOW);
    delay(250);
  }
  if (blue) digitalWrite(LED_B, previousBlue);
  if (green) digitalWrite(LED_G, previousGreen);
}

void reply(unsigned long id, bool ok) {
  Serial.print("{\"protocol\":1,\"board\":\"AMB82-MINI\",\"id\":");
  Serial.print(id);
  Serial.print(",\"ok\":"); Serial.print(ok ? "true" : "false");
  Serial.print(",\"blue\":"); Serial.print(digitalRead(LED_B) == HIGH ? "true" : "false");
  Serial.print(",\"green\":"); Serial.print(digitalRead(LED_G) == HIGH ? "true" : "false");
  Serial.println("}");
}

void executeLine() {
  // Exact grammar: V1 <positive decimal id> <command>. Never execute substrings.
  if (strncmp(lineBuffer, "V1 ", 3) != 0) { reply(0, false); return; }
  char *p = lineBuffer + 3;
  char *start = p;
  while (*p >= '0' && *p <= '9') ++p;
  if (p == start || p - start > 9 || *p != ' ') { reply(0, false); return; }
  unsigned long id = strtoul(start, NULL, 10);
  if (id == 0) { reply(0, false); return; }
  const char *command = p + 1;
  if (!strcmp(command, "BLUE_ON")) digitalWrite(LED_B, HIGH);
  else if (!strcmp(command, "BLUE_OFF")) digitalWrite(LED_B, LOW);
  else if (!strcmp(command, "GREEN_ON")) digitalWrite(LED_G, HIGH);
  else if (!strcmp(command, "GREEN_OFF")) digitalWrite(LED_G, LOW);
  else if (!strcmp(command, "BLUE_BLINK3")) blinkThree(true, false);
  else if (!strcmp(command, "GREEN_BLINK3")) blinkThree(false, true);
  else if (!strcmp(command, "BOTH_BLINK3")) blinkThree(true, true);
  else if (strcmp(command, "STATUS")) { reply(id, false); return; }
  reply(id, true);
}

void setup() {
  pinMode(LED_B, OUTPUT); pinMode(LED_G, OUTPUT);
  digitalWrite(LED_B, LOW); digitalWrite(LED_G, LOW);
  Serial.begin(115200);
}

void loop() {
  // An incomplete/oversized frame is discarded through the next newline.
  if (used && millis() - lastByte > 1000) { used = 0; discardLine = true; }
  while (Serial.available()) {
    char c = Serial.read(); lastByte = millis();
    if (c == '\n') {
      if (!discardLine) { lineBuffer[used] = '\0'; executeLine(); }
      else reply(0, false);
      used = 0; discardLine = false; sawCR = false;
    } else if (c == '\r') {
      // Accept CRLF, but a CR inside a command invalidates the whole line.
      if (sawCR) discardLine = true;
      sawCR = true;
    } else if (c < 32 || c > 126 || used >= sizeof(lineBuffer) - 1) {
      discardLine = true;
    } else if (sawCR) discardLine = true;
    else if (!discardLine) lineBuffer[used++] = c;
  }
}
