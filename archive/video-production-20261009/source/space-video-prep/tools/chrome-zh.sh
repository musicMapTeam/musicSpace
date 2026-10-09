#!/bin/sh
# Chrome with a Simplified-Chinese UI locale (native form controls such as the file chooser read 选择文件 / 未选择任何文件); NSUserDefaults argument-domain override, nothing is written to the user's Chrome profile.
exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" -AppleLanguages '(zh-CN)' -AppleLocale zh_CN "$@"
