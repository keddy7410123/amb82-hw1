# AMB82-MINI 語音 LED 控制

使用電腦版 Chrome 的麥克風與 Web Speech API 辨識中文，再透過 Web Serial / USB UART 控制板上 LED。無須 Wi-Fi 密碼、API key 或後端套件。此版本採「電腦」操作，手機不支援本系統的 USB Web Serial 流程。

## 板卡與腳位

使用者已確認板型為 **AMB82-MINI（RTL8735B）**。

| 指令方向 | 板上 LED | Arduino 腳位 | 晶片 GPIO | 亮 / 滅 |
|---|---|---|---|---|
| 左邊 | LED_B 藍燈 | D23 | PF9 | HIGH / LOW |
| 右邊 | LED_G 綠燈 | D24 | PE6 | HIGH / LOW |

左右是本作業的指令對應，轉動板子不會改變對應。開機將兩燈設為 LOW。韌體使用 SDK 的 LED_B / LED_G，並靜態檢查腳位；不可套用其他 Ameba 板型。

依據：[官方 AMB82-MINI 入門與腳位表](https://github.com/Ameba-AIoT/ameba-arduino-doc/blob/main/source/ameba_pro2/amb82-mini/Getting_Started/Getting%20Started%20with%20Ameba.rst)、[官方 SDK ControlLED 範例](https://github.com/Ameba-AIoT/ameba-arduino-pro2/blob/main/Arduino_package/hardware/libraries/WiFi/examples/SimpleHttpWeb/ControlLED/ControlLED.ino)。本機 AmebaPro2 4.1.0 的 variant.h 與 ControlLED.ino 亦已交叉確認；最終仍需實板目視驗證燈色與亮滅。

## 啟動

1. Arduino IDE 安裝 Realtek AmebaPro2，選擇 **AMB82-MINI**，開啟 `firmware/VoiceLED/VoiceLED.ino`。
2. 接上板子的 USB UART 連接埠。按住 UART_DOWNLOAD，按下再放開 RESET，最後放開 UART_DOWNLOAD，進入燒錄模式。
3. 選擇序列埠並上傳；完成後按 RESET。關閉 Arduino 序列監控視窗，避免占用序列埠。
4. 在專案目錄執行：

   ```sh
   python3 -m http.server 8000 --bind 127.0.0.1 --directory web
   ```

5. 電腦 Chrome 開啟 <http://localhost:8000>，按「連接開發板」，選擇板子的 USB 序列埠。
6. 顯示「已連接 · AMB82-MINI」後，點擊麥克風並允許權限，說出一個指令。

CLI 編譯與燒錄（依實際裝置修改 `--port`）：

```sh
arduino-cli compile --fqbn realtek:AmebaPro2:Ameba_AMB82-MINI firmware/VoiceLED
arduino-cli upload --fqbn realtek:AmebaPro2:Ameba_AMB82-MINI --port /dev/cu.usbserial-130 firmware/VoiceLED
```

## 支援語句

| 語音 | 動作 |
|---|---|
| 左邊開燈 / 開藍燈 / 藍燈開燈 | 藍燈亮 |
| 左邊關燈 / 關藍燈 / 藍燈關燈 | 藍燈滅 |
| 右邊開燈 / 開綠燈 / 綠燈開燈 | 綠燈亮 |
| 右邊關燈 / 關綠燈 / 綠燈關燈 | 綠燈滅 |
| 左邊閃爍三次 / 藍燈閃爍三次 | 藍燈閃爍三次 |
| 右邊閃爍三次 / 綠燈閃爍三次 | 綠燈閃爍三次 |
| 閃爍三次 / 全部閃爍三次 | 兩燈同時閃爍三次 |

閃爍語句也接受數字「3」。板端先熄滅 250 ms，再亮／滅各 250 ms，共三輪，最後恢復各燈原本狀態；單燈閃爍不影響另一燈。全程約 1.75 秒，完成才回覆 ACK，介面等待上限為 5 秒。期間板端依序處理指令，前端不接受新的控制。

介面預設勾選「語音回覆」，由電腦喇叭播報控制結果或無法辨識的提示。成功播報須等板端 ACK；背景狀態輪詢不播報。開始收音前停止播放，收音結束後才播報，避免回覆被辨識成指令。可取消勾選關閉；中文聲音依作業系統與瀏覽器提供，播放失敗仍保留文字回饋。使用 [Web Speech 語音合成 API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)。

忽略空白、一般標點及上述簡體字差異。只接受完整白名單語句；否定句、聊天、模糊語句及一次兩個指令不傳送。每次點擊辨識最多執行一筆最終結果。文字測試使用同一解析器，不是語音辨識的替代驗收。

## 通訊與回饋

115200 baud，ASCII 換行分包。例如 `V1 12 BLUE_ON\n`。
只允許 `BLUE_ON`、`BLUE_OFF`、`GREEN_ON`、`GREEN_OFF`、`BLUE_BLINK3`、`GREEN_BLINK3`、`BOTH_BLINK3`、`STATUS`；ID 為 1 至 9 位正整數。
板端回覆範例：

```json
{"protocol":1,"board":"AMB82-MINI","id":12,"ok":true,"blue":true,"green":false}
```

畫面僅採用符合協定、板型及待處理 ID 的回覆。板型欄位是韌體宣告，不是晶片自動辨識。狀態來自板端 `digitalRead()`，表示 GPIO 電位，不代表有光學感測器確認 LED 正常發光。每 5 秒於閒置時查詢；逾時 3 秒或斷線就標示未知。通訊失敗可能發生在板子已執行但回覆遺失之後，因此顯示「結果未知」，不自動重送控制指令。

韌體先驗證完整封包再動作，超長或不完整封包整行丟棄；錯誤指令不改 LED。重新讀取狀態可恢復顯示。

## 驗收

- 開啟 <http://localhost:8000/tests.html> 執行語句解析與回覆驗證測試。
- 韌體協定測試：`c++ -std=c++17 -I tests tests/firmware_test.cpp -o /tmp/ameba-firmware-test && /tmp/ameba-firmware-test`。使用 GPIO/Serial 替身執行真實韌體程式，涵蓋錯誤 ID、超長輸入、逾時與分段 CRLF；不取代硬體驗收。
- 實板依序說「左邊開燈」「右邊開燈」「左邊關燈」「右邊關燈」，確認對應 LED、辨識文字與成功訊息。
- 說「不要左邊開燈」「今天天氣很好」與一次兩個指令，確認沒有燈號變化。
- 拔掉 USB，確認提示且兩燈狀態變未知；接回後重新連接。
- 拒絕麥克風權限或斷開網路，確認語音錯誤提示且不送控制。
- 重新 RESET，確認兩燈熄滅並在下一次狀態查詢反映。

2026-09-29 更新：瀏覽器 33 項解析斷言與韌體主機測試通過，包含三種閃爍指令、四種初始燈號組合、三次明滅時序及狀態恢復。經使用者同意安裝 Rosetta 後，新版已於 AmebaPro2 4.1.0 編譯通過（4,788,224 bytes，28% Flash），並透過官方 image_macos 工具燒錄至 `/dev/cu.usbserial-110`，回報 `upload success`。燒錄前已關閉占用序列埠的 Arduino serial-monitor。請按 RESET 啟動新版；實體三次閃爍與語音端到端操作仍需驗收。

## 排除問題

- 找不到埠：使用可傳資料的 USB 線與 USB UART 接孔；確認作業系統已辨識裝置。
- 埠被占用：關閉 Arduino Serial Monitor 或其他使用該埠的程式。
- 握手逾時：確認已燒錄本韌體、燒錄後按 RESET，選擇正確埠，再重新連接。
- 語音不可用：使用電腦 Chrome、localhost，允許麥克風並連網。[Web Speech 支援有瀏覽器限制，Chrome 可能使用雲端辨識](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)；不保證離線可用。
- 手機操作：本實作選定電腦 USB 方案；如需手機需另加 Wi-Fi 傳輸與 HTTPS 語音入口。

Web Serial 依據：[Chrome 官方文件](https://developer.chrome.com/docs/capabilities/serial)。
