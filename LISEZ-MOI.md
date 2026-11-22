# RESULTA JEUX – site sur Vercel (mise à jour automatique)

Le site affiche Loto, EuroMillions, EuroDreams, Quinté+ et Loto Foot.
**Loto, EuroMillions et EuroDreams se mettent à jour tout seuls** : à chaque visite (et toutes les 30 minutes
si la page reste ouverte), le site lit les archives officielles publiées par la FDJ sur fdj.fr
(depuis oct. 2008 pour le Loto, fév. 2004 pour EuroMillions, nov. 2023 pour EuroDreams).
Aucune clé d'API n'est nécessaire.

> Quinté+ et Loto Foot : la FDJ/PMU ne publient pas d'archive officielle téléchargeable ;
> ils restent à saisir à la main dans le site.

## Contenu du dossier
- `public/index.html` : le site
- `api/results.js` : la petite API (Vercel Function) qui lit les archives FDJ
- `package.json`, `vercel.json` : configuration (rien à modifier)

## Mise en ligne – méthode 1 (sans ligne de commande)
1. Crée un compte gratuit sur github.com, puis un dépôt vide nommé `resulta-jeux`.
2. Dans le dépôt : **Add file → Upload files**, puis glisse **tout le contenu du dossier** (les dossiers `api` et `public` + les 2 fichiers). Clique **Commit changes**.
3. Va sur vercel.com, connecte-toi avec GitHub, clique **Add New → Project**, choisis `resulta-jeux`, puis **Deploy**. Ne change aucun réglage.
4. Au bout d'une minute, Vercel te donne une adresse `https://resulta-jeux-xxxx.vercel.app`.

## Mise en ligne – méthode 2 (terminal)
```
npm install -g vercel
cd resulta-jeux-vercel
vercel --prod
```

## Vérifier que ça marche
Ouvre `https://TON-SITE.vercel.app/api/results?game=loto` : tu dois voir du JSON avec `"count"` (le nombre de tirages) et `"draws"`.
Remplace `loto` par `euromillions` ou `eurodreams` pour les autres jeux.
Sur le site, le message « ✅ Synchronisé avec les archives officielles FDJ » apparaît sur l'accueil.

## Si la synchronisation échoue
- Message « ⚠️ Synchronisation impossible » : ouvre l'adresse `/api/results?game=loto` ; si elle affiche une erreur (par exemple HTTP 403), c'est que fdj.fr refuse la requête du serveur. Dans ce cas, le site continue de fonctionner avec les données déjà enregistrées, et tu peux importer le ZIP FDJ à la main (onglet « Ajouter / Importer »).
- Les archives FDJ sont mises à jour par la FDJ : un tirage peut apparaître quelques heures après le tirage.

## Jeu responsable
Résultats donnés à titre indicatif ; seuls font foi ceux de la FDJ et du PMU. Jouer comporte des risques :
endettement, isolement, dépendance. Joueurs Info Service : 09 74 75 13 13 (appel non surtaxé).
