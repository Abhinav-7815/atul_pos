#Persistent
#SingleInstance Force
SetTitleMatchMode, 2

Loop {
    ; Chrome ya Electron print dialog detect karo
    if WinExist("Print") {
        WinActivate, Print
        Sleep, 800
        ; "Print" button press karo (Enter = default button)
        ControlClick, Button1, Print
        Sleep, 500
        ; Agar Enter se nahi hua toh
        Send, {Enter}
        Sleep, 1000
    }
    Sleep, 200
}
