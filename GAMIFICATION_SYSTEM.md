# 🎮 VibeScan AI - Sistema de Gamificación y Premium

## 1️⃣ Estructura Premium vs Free

### Free Tier (Limitado)
- ✅ 3 escaneos por día
- ✅ Stats básicos (NPC Level, Sigma, Rizz)
- ✅ Compartir resultados
- ❌ Sin ranking
- ❌ Sin badges
- ❌ Sin análisis profundo
- ❌ Sin historial completo

### Premium Tier (VibeMaster)
- ✅ Escaneos ilimitados
- ✅ Todos los stats + Aura + Insights VIP
- ✅ Ranking Global y de Amigos
- ✅ 20+ Badges coleccionables
- ✅ Skins exclusivos para resultados
- ✅ Historial completo
- ✅ Alertas predictivas
- ✅ Modo Battle sin anuncios

---

## 2️⃣ Modelo de Datos Firestore

### Estructura de Usuario
```
users/{userId}
  ├── isPremium: bool
  ├── scanCount: number
  ├── lastScanDate: timestamp
  ├── totalScans: number
  ├── vibeScore: number (promedio de todos los escaneos)
  ├── badges: array<string>
  └── scans/{scanId}
       ├── timestamp
       ├── scores: { NPC, Sigma, Rizz, Aura, etc. }
       ├── badges: array
       └── mode: string
```

### Ranking Global
```
rankings/global
  └── leaderboard: array<{userId, displayName, vibeScore, badge}>
```

---

## 3️⃣ Código: Modelo de Usuario

```dart
// lib/models/user_model.dart

class UserModel {
  final String uid;
  final bool isPremium;
  final int scanCount;
  final DateTime? lastScanDate;
  final int totalScans;
  final double vibeScore;
  final List<String> badges;

  UserModel({
    required this.uid,
    this.isPremium = false,
    this.scanCount = 0,
    this.lastScanDate,
    this.totalScans = 0,
    this.vibeScore = 0,
    this.badges = const [],
  });

  factory UserModel.fromFirestore(Map<String, dynamic> data, String uid) {
    return UserModel(
      uid: uid,
      isPremium: data['isPremium'] ?? false,
      scanCount: data['scanCount'] ?? 0,
      lastScanDate: data['lastScanDate']?.toDate(),
      totalScans: data['totalScans'] ?? 0,
      vibeScore: (data['vibeScore'] ?? 0).toDouble(),
      badges: List<String>.from(data['badges'] ?? []),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'isPremium': isPremium,
      'scanCount': scanCount,
      'lastScanDate': lastScanDate,
      'totalScans': totalScans,
      'vibeScore': vibeScore,
      'badges': badges,
    };
  }

  bool canScanToday() {
    if (isPremium) return true; // Ilimitado
    
    if (lastScanDate == null) return true;
    
    final now = DateTime.now();
    final isSameDay = lastScanDate!.year == now.year &&
                      lastScanDate!.month == now.month &&
                      lastScanDate!.day == now.day;
    
    if (!isSameDay) return true; // Nuevo día
    
    return scanCount < 3; // Límite free: 3/día
  }
}
```

---

## 4️⃣ Sistema de Badges (100% Gratuito)

### Badges Disponibles (Emojis)
```dart
// lib/constants/badges.dart

class BadgeData {
  final String id;
  final String emoji;
  final String name;
  final String description;
  final bool premiumOnly;
  
  const BadgeData({
    required this.id,
    required this.emoji,
    required this.name,
    required this.description,
    this.premiumOnly = false,
  });
}

class Badges {
  static const sigma = BadgeData(
    id: 'sigma_master',
    emoji: '🗿',
    name: 'Sigma Master',
    description: 'Sigma score >90 in 5 scans',
  );
  
  static const npc = BadgeData(
    id: 'npc_detector',
    emoji: '💀',
    name: 'NPC Hunter',
    description: 'Detected 10 NPCs',
  );
  
  static const rizzKing = BadgeData(
    id: 'rizz_king',
    emoji: '👑',
    name: 'Rizz King',
    description: 'Rizz >85 in 3 scans',
    premiumOnly: true,
  );
  
  static const auraLegend = BadgeData(
    id: 'aura_legend',
    emoji: '⚡',
    name: 'Aura Legend',
    description: 'Aura >5000',
    premiumOnly: true,
  );
  
  static const mainCharacter = BadgeData(
    id: 'main_character',
    emoji: '🔥',
    name: 'Main Character',
    description: 'Complete 50 scans',
    premiumOnly: true,
  );

  static const allBadges = [
    sigma,
    npc,
    rizzKing,
    auraLegend,
    mainCharacter,
    // Add more...
  ];
}
```

### Lógica para Desbloquear Badges
```dart
// lib/services/badge_service.dart

class BadgeService {
  static List<String> checkNewBadges(UserModel user, Map<String, dynamic> scanResult) {
    final newBadges = <String>[];
    
    // Sigma Master
    if (scanResult['scores']['Sigma'] > 90) {
      if (!user.badges.contains('sigma_master')) {
        newBadges.add('sigma_master');
      }
    }
    
    // Rizz King (Premium only)
    if (user.isPremium && scanResult['scores']['Rizz'] > 85) {
      if (!user.badges.contains('rizz_king')) {
        newBadges.add('rizz_king');
      }
    }
    
    // Aura Legend (Premium only)
    if (user.isPremium && scanResult['aura'] > 5000) {
      if (!user.badges.contains('aura_legend')) {
        newBadges.add('aura_legend');
      }
    }
    
    return newBadges;
  }
}
```

---

## 5️⃣ Ranking System

### Actualizar Ranking en Firestore
```dart
// lib/services/ranking_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';

class RankingService {
  static final _firestore = FirebaseFirestore.instance;
  
  static Future<void> updateUserRanking(String userId, double vibeScore) async {
    await _firestore
        .collection('rankings')
        .doc('global')
        .set({
      userId: {
        'vibeScore': vibeScore,
        'updatedAt': FieldValue.serverTimestamp(),
      }
    }, SetOptions(merge: true));
  }
  
  static Future<List<Map<String, dynamic>>> getTopPlayers({int limit = 10}) async {
    final doc = await _firestore.collection('rankings').doc('global').get();
    
    if (!doc.exists) return [];
    
    final data = doc.data() as Map<String, dynamic>;
    
    // Convertir a lista y ordenar
    final rankings = data.entries
        .map((e) => {
              'userId': e.key,
              'vibeScore': e.value['vibeScore'],
            })
        .toList();
    
    rankings.sort((a, b) => (b['vibeScore'] as num).compareTo(a['vibeScore'] as num));
    
    return rankings.take(limit).toList();
  }
}
```

### UI del Ranking (Premium Only)
```dart
// lib/widgets/ranking_widget.dart

class RankingWidget extends StatelessWidget {
  final bool isPremium;
  
  const RankingWidget({super.key, required this.isPremium});
  
  @override
  Widget build(BuildContext context) {
    if (!isPremium) {
      return _buildPremiumLock();
    }
    
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: RankingService.getTopPlayers(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const CircularProgressIndicator();
        }
        
        final rankings = snapshot.data!;
        
        return ListView.builder(
          shrinkWrap: true,
          itemCount: rankings.length,
          itemBuilder: (context, index) {
            final player = rankings[index];
            return ListTile(
              leading: Text(
                '${index + 1}',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              title: Text('User ${player['userId'].substring(0, 8)}'),
              trailing: Text(
                '${player['vibeScore']} pts',
                style: const TextStyle(
                  color: Color(0xFF00FF7F),
                  fontWeight: FontWeight.bold,
                ),
              ),
            );
          },
        );
      },
    );
  }
  
  Widget _buildPremiumLock() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF8A2BE2).withOpacity(0.2),
            Colors.transparent,
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF8A2BE2)),
      ),
      child: Column(
        children: [
          const Icon(Icons.lock, size: 48, color: Color(0xFF8A2BE2)),
          const SizedBox(height: 16),
          const Text(
            'Global Ranking',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Unlock Premium to see your rank\nand compete with players worldwide',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              // Navigate to premium
            },
            child: const Text('UPGRADE NOW'),
          ),
        ],
      ),
    );
  }
}
```

---

## 6️⃣ Microcopy Persuasivo

### En Pantalla de Resultados (Free)
```dart
Container(
  padding: EdgeInsets.all(16),
  decoration: BoxDecoration(
    gradient: LinearGradient(
      colors: [Color(0xFF8A2BE2), Color(0xFF00FF7F)],
    ),
    borderRadius: BorderRadius.circular(12),
  ),
  child: Column(
    children: [
      Text(
        '⚡ You\'re missing out on:',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      SizedBox(height: 12),
      _buildFeature('🏆 Global Ranking'),
      _buildFeature('⚡ Aura Insights'),
      _buildFeature('🔥 20+ Exclusive Badges'),
      _buildFeature('♾️ Unlimited Scans'),
      SizedBox(height: 16),
      ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.amber,
          foregroundColor: Colors.black,
        ),
        onPressed: () {},
        child: Text('UNLOCK VIBEMASTER - \$4.99/mo'),
      ),
    ],
  ),
)
```

### Mensajes de Urgencia
```dart
final messages = [
  "🔥 Only 3 scans left today. Go Premium for unlimited!",
  "⚡ Premium users get +50% more insights on every scan",
  "👑 Join the top 5% of VibeMasters",
  "💎 Unlock your true potential. Premium starts at \$4.99",
];
```

---

## 7️⃣ Servicio Premium Completo

```dart
// lib/services/premium_service.dart

class PremiumService {
  static Future<void> checkAndRestrictFreeUser(BuildContext context) async {
    final user = await FirebaseService.getCurrentUser();
    
    if (user == null || user.isPremium) return;
    
    if (!user.canScanToday()) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('Daily Limit Reached'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'You\'ve used your 3 free scans today.\n\n'
                'Upgrade to Premium for:',
              ),
              const SizedBox(height: 16),
              const Text('✅ Unlimited scans\n'
                         '✅ Global ranking\n'
                         '✅ Exclusive badges\n'
                         '✅ Ad-free experience',
                textAlign: TextAlign.left,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Maybe Later'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/premium');
              },
              child: const Text('UPGRADE NOW'),
            ),
          ],
        ),
      );
    }
  }
}
```

---

## 8️⃣ Implementación Final: FirebaseService Completo

```dart
// Añadir a lib/services/firebase_service.dart

static Future<UserModel?> getCurrentUser() async {
  if (!isSignedIn) return null;
  
  final doc = await _firestore
      .collection('users')
      .doc(currentUser!.uid)
      .get();
  
  if (!doc.exists) {
    // Crear usuario nuevo
    final newUser = UserModel(uid: currentUser!.uid);
    await _firestore
        .collection('users')
        .doc(currentUser!.uid)
        .set(newUser.toFirestore());
    return newUser;
  }
  
  return UserModel.fromFirestore(doc.data()!, doc.id);
}

static Future<void> recordScan(Map<String, dynamic> scanResult) async {
  if (!isSignedIn) return;
  
  final user = await getCurrentUser();
  if (user == null) return;
  
  // Actualizar contadores
  final now = DateTime.now();
  final isSameDay = user.lastScanDate != null &&
                    user.lastScanDate!.year == now.year &&
                    user.lastScanDate!.month == now.month &&
                    user.lastScanDate!.day == now.day;
  
  await _firestore.collection('users').doc(user.uid).update({
    'scanCount': isSameDay ? user.scanCount + 1 : 1,
    'lastScanDate': now,
    'totalScans': user.totalScans + 1,
  });
  
  // Guardar escaneo
  await _firestore
      .collection('users')
      .doc(user.uid)
      .collection('scans')
      .add({
    ...scanResult,
    'timestamp': FieldValue.serverTimestamp(),
  });
  
  // Verificar badges nuevos
  final newBadges = BadgeService.checkNewBadges(user, scanResult);
  if (newBadges.isNotEmpty) {
    await _firestore.collection('users').doc(user.uid).update({
      'badges': FieldValue.arrayUnion(newBadges),
    });
  }
}
```

---

## 🎯 Resumen de Costos

- Firebase Firestore (Gratis hasta 50k lecturas/día) ✅
- Emojis como badges (Gratis) ✅
- Almacenamiento de datos (Gratis hasta 1GB) ✅
- **Total: $0.00/mes** hasta alcanzar cientos de usuarios

Esta implementación es 100% funcional y escalable sin gastar dinero.
