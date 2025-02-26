import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/meal/meal_provider.dart';
import '../../providers/settings/settings_provider.dart';
import '../../models/meal.dart';
import '../meal_entry/add_meal_screen.dart';
import '../settings/settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Fetch meals and settings when screen loads
    Future.microtask(() {
      final mealProvider = Provider.of<MealProvider>(context, listen: false);
      final settingsProvider = Provider.of<SettingsProvider>(context, listen: false);
      
      mealProvider.fetchMeals();
      settingsProvider.fetchSettings();
    });
  }
  
  // Get emoji based on health score
  String _getHealthScoreEmoji(int score) {
    switch (score) {
      case 1: return '😔';
      case 2: return '😐';
      case 3: return '🙂';
      case 4: return '😊';
      case 5: return '😄';
      default: return '🤔';
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final mealProvider = Provider.of<MealProvider>(context);
    final settingsProvider = Provider.of<SettingsProvider>(context);
    
    final todayMeals = mealProvider.todayMeals;
    final todayCalories = mealProvider.todayCalories;
    final dailyCalorieTarget = settingsProvider.dailyCalorieTarget;
    final remainingCalories = dailyCalorieTarget - todayCalories;
    final progress = todayCalories / dailyCalorieTarget;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Calorie Tracker'),
        elevation: 0,
        actions: [
          // Settings button
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const SettingsScreen(),
                ),
              );
            },
          ),
          
          // Logout button
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Logout'),
                  content: const Text('Are you sure you want to logout?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.pop(context);
                        authProvider.signOut();
                      },
                      child: const Text('Logout'),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: mealProvider.isLoading || settingsProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                await mealProvider.fetchMeals();
                await settingsProvider.fetchSettings();
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // User greeting
                      if (authProvider.user != null)
                        Text(
                          'Hello, ${authProvider.user!.displayName ?? 'User'}!',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      
                      const SizedBox(height: 24),
                      
                      // Calories progress card
                      Card(
                        elevation: 4,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              const Text(
                                'Today\'s Calories',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              
                              const SizedBox(height: 16),
                              
                              // Progress indicator
                              LinearProgressIndicator(
                                value: progress.clamp(0.0, 1.0),
                                minHeight: 16,
                                backgroundColor: Colors.grey[300],
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  progress > 1.0 ? Colors.red : Colors.green,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              
                              const SizedBox(height: 16),
                              
                              // Calorie details
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  _buildCalorieInfo(
                                    'Consumed', 
                                    '$todayCalories',
                                    Colors.orange,
                                  ),
                                  _buildCalorieInfo(
                                    'Remaining', 
                                    remainingCalories < 0 
                                      ? '0 (${remainingCalories.abs()} over)'
                                      : '$remainingCalories',
                                    remainingCalories < 0 ? Colors.red : Colors.green,
                                  ),
                                  _buildCalorieInfo(
                                    'Target', 
                                    '$dailyCalorieTarget',
                                    Colors.blue,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // Today's meals section
                      const Text(
                        'Today\'s Meals',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      
                      const SizedBox(height: 16),
                      
                      // Meals list
                      todayMeals.isEmpty
                          ? const Center(
                              child: Padding(
                                padding: EdgeInsets.all(32.0),
                                child: Text(
                                  'No meals added today. Tap the + button to add one!',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: Colors.grey,
                                  ),
                                ),
                              ),
                            )
                          : ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: todayMeals.length,
                              itemBuilder: (context, index) {
                                final meal = todayMeals[index];
                                return _buildMealItem(meal, mealProvider);
                              },
                            ),
                    ],
                  ),
                ),
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const AddMealScreen(),
            ),
          ).then((_) {
            // Refresh meals when returning from add meal screen
            mealProvider.fetchMeals();
          });
        },
        child: const Icon(Icons.add),
      ),
    );
  }
  
  // Build calorie info widget
  Widget _buildCalorieInfo(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            color: color,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
  
  // Build meal item widget
  Widget _buildMealItem(Meal meal, MealProvider mealProvider) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            meal.imageUrl,
            width: 60,
            height: 60,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: 60,
                height: 60,
                color: Colors.grey[300],
                child: const Icon(Icons.broken_image),
              );
            },
          ),
        ),
        title: Text(
          meal.name,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (meal.description != null && meal.description!.isNotEmpty)
              Text(meal.description!),
            Text(
              meal.time,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
              ),
            ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${meal.calories} cal',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _getHealthScoreEmoji(meal.healthScore),
              style: const TextStyle(fontSize: 20),
            ),
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Delete Meal'),
                    content: const Text('Are you sure you want to delete this meal?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          mealProvider.deleteMeal(meal.id);
                        },
                        child: const Text('Delete'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}