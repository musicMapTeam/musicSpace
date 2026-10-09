# 统一入场与近场适配 · 2026-10-02

负责人 Codex。Web/Node/Worker 实施完成后分别验收；原生适配代码不是已签名移动应用，不代表 BLE/NFC 硬件完成。

## 同一个邀请

`https://<同源站点>/event-room/?room=<12位A-Z2-7>`；长期社群使用唯一 `community` 参数。二维码、NDEF URI、GATT UTF-8 值必须是同一个完整网址。不得携带身份 token、照片 URL、好友许可或定位。共享实现 `runtime-preview/src/admission-protocol.js`；跨站、错误路径、凭据、重复/混合参数、控制字符和片段拒绝。链接和手填邀请码都只读预览，再由本人勾选明确加入；旧链接/旧 API 保持兼容。

本地 HTTP 二维码和链接只在该地址实际可达时有用；127.0.0.1 不能当作另一部手机的地址。不伪造 HTTPS 地址。NFC 标签写入只在 HTTPS 且浏览器暴露 NDEFReader 时显示，由主动点击请求，重复点击不重复写，关闭面板中止待完成操作。它是标签写入，不是手机间 NFC 点对点。当前 本机验收实例 为本地 HTTP，未触发任何 NFC 权限。

Node/Worker 原生预览别名 `/api/event/admission/room/<code>/preview` GET、加入别名 `/api/event/admission/room/<code>/join` POST 共用既有实现；POST 必须身份、幂等键和 `joinConsent:true`。社群预览别名 `/api/event/admission/community/<code>/preview` 仍需身份，加入使用预览返回的确定 ID 与原有 conversation/join。传输不绕过房间关闭、移除、照片读取或明确社群许可。

## 原生接续契约

`native/admission/InvitationAdapter.kt` 和 `.swift` 是可审阅的 Android/iOS 传输适配源码：统一 HTTPS 校验、NDEF URI 编解码、严格 UTF-8 GATT 值编解码，只返回待预览 URL，不执行加入。共享 service `6d757369-6373-4070-9163-652d696e7669`，只读 URL characteristic `6d757369-6373-4070-9163-652d75726c31`，上限 2048 字节。广播只放 service UUID，不把长 URL 塞入传统 31 字节广播。GATT server 用 read/read-blob offset 返回 URL 分片，central 完整重组并校验后才显示服务端预览。不可把广播名/信号强度当作身份或到场证据。

两人入场后近场发现是独立主动选择，不能从入场同意推导 radio 权限。外围端与 central 都由用户明确启动，切后台/取消/离场停止扫描、广播和连接；10 秒扫描上限，超时让人重试。拒绝权限仍可用二维码/链接。NFC 使用实体标签；不承诺 iPhone 和 Android 相碰即可互传。普通 Web Bluetooth 页面作为 central 不能替代原生 peripheral 广播。

Android host app 仍需 BluetoothLeScanner、BluetoothLeAdvertiser、BluetoothGattServer lifecycle 实装、Android 12+ BLUETOOTH_SCAN/CONNECT/ADVERTISE runtime permissions，旧版定位条件按目标 SDK 核对；NfcAdapter/NDEF 标签的容量、写保护和 reader mode 生命周期须实测。iOS host app 仍需 CoreBluetooth central/peripheral foreground lifecycle、蓝牙用途说明、CoreNFC reader session、entitlement/用途说明、签名和真机。无线电回调仅生成待预览地址，不自动打开网页或发送 POST。

此仓库没有 Android/iOS 构建工程、签名配置或实体手机；适配源码未编译、广播/扫描、系统授权、NFC 读写均未硬件验收。没有新增 SDK、账号、凭据、外部服务、购买或系统权限。外部验收需两台支持 BLE 的手机、可写 NDEF 标签、原生宿主工程和相应签名权限；测试拒绝/取消/后台、MTU 分片、恶意广播、同源错房、关房、重放和双边显式入场。

## 官方依据（实际读取）

- [Web NFC specification](https://w3c-cg.github.io/web-nfc/)：NDEF 标签；明确不支持 peer-to-peer。
- [Android BLE scanning](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices)、[BluetoothLeAdvertiser](https://developer.android.com/reference/android/bluetooth/le/BluetoothLeAdvertiser)、[NdefRecord](https://developer.android.com/reference/android/nfc/NdefRecord)：扫描/广播与 URI record 的系统接口。
- [Apple peripheral advertising](https://developer.apple.com/documentation/corebluetooth/cbperipheralmanager/startadvertising(_:))、[Core NFC reader session](https://developer.apple.com/documentation/corenfc/nfcndefreadersession)：原生 peripheral 与标签读取路线。未把以上文档当作本仓库已运行的证据。
