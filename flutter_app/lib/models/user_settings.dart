class UserSettings {
  final int dailyCalorieTarget;
  final String userId;

  UserSettings({
    required this.dailyCalorieTarget,
    required this.userId,
  });

  factory UserSettings.fromJson(Map<String, dynamic> json) {
    return UserSettings(
      dailyCalorieTarget: json['dailyCalorieTarget'] as int? ?? 2000,
      userId: json['userId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dailyCalorieTarget': dailyCalorieTarget,
      'userId': userId,
    };
  }

  // Default settings if none exist
  factory UserSettings.defaultSettings(String userId) {
    return UserSettings(
      dailyCalorieTarget: 2000,
      userId: userId,
    );
  }
}