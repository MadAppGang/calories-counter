class Meal {
  final String id;
  final String name;
  final String? description;
  final int calories;
  final String imageUrl;
  final int timestamp;
  final int healthScore;
  final String time;
  final String userId;

  Meal({
    required this.id,
    required this.name,
    this.description,
    required this.calories,
    required this.imageUrl,
    required this.timestamp,
    required this.healthScore,
    required this.time,
    required this.userId,
  });

  factory Meal.fromJson(Map<String, dynamic> json) {
    return Meal(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      calories: json['calories'] as int,
      imageUrl: json['imageUrl'] as String,
      timestamp: json['timestamp'] as int,
      healthScore: json['healthScore'] as int,
      time: json['time'] as String,
      userId: json['userId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'calories': calories,
      'imageUrl': imageUrl,
      'timestamp': timestamp,
      'healthScore': healthScore,
      'time': time,
      'userId': userId,
    };
  }
}