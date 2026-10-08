# Accès au staff

Ce fichier explique comment gérer les identifiants et mots de passe de l'espace staff (`staff.html`).

**Les mots de passe ne s'écrivent pas dans ce fichier.** Le dépôt GitHub est public (obligatoire pour GitHub Pages gratuit) : tout ce qui est écrit ici est lisible par n'importe qui. Les mots de passe se mettent dans un **secret GitHub**, invisible pour tout le monde.

## Créer ou modifier la liste des accès

1. Dans le dépôt GitHub : **Settings › Secrets and variables › Actions**, onglet **Secrets**.
2. **New repository secret** (ou le crayon à côté de `ACCES_STAFF` s'il existe déjà).
3. Nom : `ACCES_STAFF`
4. Valeur : une ligne par personne, sous la forme `identifiant : mot de passe`. Exemple :

   ```
   staff.lattes : MonMotDePasse2026
   julie : AutreMotDePasse
   karim : EncoreUnAutre
   ```

5. **Add secret** (ou **Update secret**).
6. Onglet **Actions › Déployer › Run workflow** : la liste est appliquée en 2 minutes environ.

## Règles

- Identifiant : 3 à 30 caractères, lettres sans accent, chiffres, point ou tiret. Majuscules et minuscules sont équivalentes.
- Mot de passe : 6 caractères minimum.
- Une ligne qui commence par `#` est ignorée (pratique pour désactiver quelqu'un temporairement).
- **La liste fait foi** : un identifiant absent de la liste est supprimé au déploiement, et les appareils qui l'utilisaient sont déconnectés.
- Changer un mot de passe dans la liste le change au prochain déploiement ; les appareils déjà connectés restent connectés.

## Sur place

- Tablette : scanner le QR code staff (espace staff › Réglages › Accès staff), puis se connecter.
- Ordinateur : ouvrir `https://VOTRE-COMPTE.github.io/VOTRE-DEPOT/staff.html`, puis se connecter.
- L'appareil reste connecté jusqu'au bouton **Se déconnecter**.

## Sans le secret `ACCES_STAFF`

Les identifiants se gèrent directement dans l'espace staff : **Réglages › Accès staff** (ajouter, changer un mot de passe, supprimer). Tant qu'aucun identifiant n'existe, la page staff propose de créer le premier.
