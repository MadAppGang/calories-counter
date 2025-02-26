import Cocoa
import FlutterMacOS
import Firebase

@main
class AppDelegate: FlutterAppDelegate {
  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    return true
  }

  override func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
    return true
  }
  
  // Handle URL scheme callbacks (required for Google Sign-In)
  override func application(_ application: NSApplication, open urls: [URL]) {
    for url in urls {
      print("Received URL: \(url.absoluteString)")
      if url.scheme?.contains("googleusercontent") == true {
        let notification = Notification(
          name: Notification.Name("GoogleSignInCallback"),
          object: nil,
          userInfo: ["url": url])
        NotificationCenter.default.post(notification)
      }
    }
  }
}
