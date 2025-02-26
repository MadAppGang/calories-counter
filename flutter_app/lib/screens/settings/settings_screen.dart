import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/settings/settings_provider.dart';
import '../../providers/auth/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _calorieTargetController = TextEditingController();
  bool _isLoading = false;
  
  @override
  void initState() {
    super.initState();
    // Initialize the form with current settings
    final settingsProvider = Provider.of<SettingsProvider>(context, listen: false);
    _calorieTargetController.text = settingsProvider.dailyCalorieTarget.toString();
  }
  
  @override
  void dispose() {
    _calorieTargetController.dispose();
    super.dispose();
  }
  
  // Save updated settings
  Future<void> _saveSettings() async {
    if (_formKey.currentState?.validate() != true) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final settingsProvider = Provider.of<SettingsProvider>(context, listen: false);
      
      await settingsProvider.updateSettings(
        dailyCalorieTarget: int.parse(_calorieTargetController.text),
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Settings saved successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save settings: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final settingsProvider = Provider.of<SettingsProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User profile section
              if (authProvider.user != null)
                Card(
                  elevation: 4,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        // User avatar
                        CircleAvatar(
                          radius: 32,
                          backgroundImage: authProvider.user!.photoURL != null
                              ? NetworkImage(authProvider.user!.photoURL!)
                              : null,
                          child: authProvider.user!.photoURL == null
                              ? const Icon(Icons.person, size: 40)
                              : null,
                        ),
                        
                        const SizedBox(width: 16),
                        
                        // User details
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                authProvider.user!.displayName ?? 'User',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                authProvider.user!.email,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              
              const SizedBox(height: 24),
              
              // Settings form
              const Text(
                'Calorie Settings',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              
              const SizedBox(height: 16),
              
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _calorieTargetController,
                      decoration: const InputDecoration(
                        labelText: 'Daily Calorie Target',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.local_fire_department),
                        hintText: 'e.g., 2000',
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter a daily calorie target';
                        }
                        final calories = int.tryParse(value);
                        if (calories == null) {
                          return 'Please enter a valid number';
                        }
                        if (calories < 500 || calories > 10000) {
                          return 'Please enter a reasonable calorie target (500-10000)';
                        }
                        return null;
                      },
                    ),
                    
                    const SizedBox(height: 24),
                    
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _saveSettings,
                        style: ElevatedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isLoading
                            ? const CircularProgressIndicator()
                            : const Text(
                                'Save Settings',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 32),
              
              // App info section
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'About',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text('Calorie Tracker App v1.0.0'),
                      SizedBox(height: 4),
                      Text('Track your daily meals and monitor calorie intake'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}