# EPEX Spot

Cette intégration apporte dans Gladys les **prix day-ahead de l'électricité**
de votre zone de prix : le résultat de l'enchère quotidienne du marché
européen couplé (EPEX Spot), au **quart d'heure**. Elle sert à suivre le prix
de l'électricité, à déclencher vos appareils aux heures les moins chères et à
calculer le coût réel d'un **contrat d'électricité dynamique** (offres
indexées sur le prix spot).

Les prix viennent de l'API publique et gratuite
[energy-charts.info](https://www.energy-charts.info) (Fraunhofer ISE) : pas de
compte, pas de clé d'API. L'intégration a besoin d'un accès à Internet
(étiquette **cloud**).

## Zones prises en charge

France, Allemagne / Luxembourg, Belgique, Pays-Bas, Autriche, Suisse,
Espagne, Pologne, Danemark Ouest (DK1) et Finlande. Les prix sont en euros. La
Suisse publie des prix horaires : chaque heure est répartie sur ses quatre
quarts d'heure.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Choisissez votre **zone de prix** (celle de votre compteur).
3. Réglez si besoin :
   - l'**intervalle de téléchargement** (60 minutes par défaut, de 15 à 360).
     Les prix du lendemain sont publiés vers 13 h : en les attendant,
     l'intégration réessaie toutes les 15 minutes d'elle-même ;
   - la **majoration affichée** (€/kWh) et la **TVA affichée** (%) : pour que
     l'appareil et les widgets montrent un prix proche de votre facture
     (marge du fournisseur, acheminement). Elles ne changent que l'affichage ;
   - l'**unité des prix des widgets** : €/kWh ou €/MWh.
4. Enregistrez, puis cliquez sur **Tester l'API des prix** : le message
   affiche le nombre de quarts d'heure reçus et le prix actuel.
5. Dans l'onglet **Découverte**, ajoutez l'appareil **EPEX Spot FR** (ou celui
   de votre zone).

## L'appareil

| Fonctionnalité                  | Contenu                             |
| ------------------------------- | ----------------------------------- |
| Current price (€/kWh)           | prix du quart d'heure en cours      |
| Next quarter-hour price (€/kWh) | prix du quart d'heure suivant       |
| Today minimum / average / max   | statistiques de la journée          |
| Tomorrow average (€/kWh)        | moyenne de demain, une fois publiée |

Les prix affichés incluent la majoration et la TVA de la configuration. Ils
peuvent être **négatifs** quand la production renouvelable dépasse la demande.

## Contrat d'électricité dynamique (Gladys 5.2 et plus)

L'intégration alimente le **calendrier spot** de votre zone (`spot-fr`,
`spot-de`…) avec le prix brut de chaque quart d'heure, et propose un **modèle
de contrat** par zone dans l'assistant de contrat d'énergie de Gladys :
**EPEX Spot dynamique – France**, etc.

Le modèle calcule, pour chaque quart d'heure :

```
énergie = prix spot × coefficient + marge
total   = (énergie + acheminement) × kWh + abonnement mensuel, TVA incluse
```

Renseignez les valeurs de votre offre (coefficient, marge, acheminement et
taxes, abonnement, TVA). Le **prix de repli** s'applique à un intervalle sans
prix spot publié. Gladys calcule ensuite les coûts de votre compteur comme
pour n'importe quel contrat, et ses propres scènes « prix du contrat
modifié » / « prix actuel » fonctionnent aussi.

Un calendrier appartient à la première intégration installée qui le déclare :
si une autre intégration alimente déjà `spot-fr`, Gladys le signale et
l'écran de configuration l'indique.

## Scènes

**Déclencheurs :**

- **Niveau du prix spot modifié** — à un quart d'heure, le prix change de
  niveau dans la journée : _négatif_, _très bas_, _bas_, _normal_, _élevé_,
  _très élevé_ (position du prix entre le minimum et le maximum du jour).
  Filtrez sur les niveaux voulus ; variables : `level`, `previous_level`,
  `price`.
- **Heures les moins chères commencées** — le créneau continu le moins cher de
  la journée (1, 2, 3, 4 ou 6 h) commence maintenant : lancez le
  lave-vaisselle, la recharge de la voiture ou le ballon d'eau chaude.
  Variables : `average_price`, `ends_at`.
- **Prix de demain publiés** — une fois par jour, vers 13 h. Variables :
  `min_price`, `max_price`, `average_price`, `cheapest_hour`,
  `negative_prices`. Idéal pour une notification.

**Actions :**

- **Lire le prix spot** — sorties `price`, `spot_price`, `level`,
  `next_price`, `found`.
- **Trouver les heures les moins chères** — durée (en heures) et période
  (24 prochaines heures, reste de la journée, demain) ; sorties `start_time`,
  `end_time`, `starts_at`, `minutes_until_start`, `average_price`,
  `starts_now`, `found`.
- **Est-ce une heure creuse ?** — indique si maintenant fait partie des N
  heures les moins chères du jour (`is_cheap`, `rank`).
- **Télécharger les prix spot** — force un téléchargement.

Exemple : « Tous les jours à 22 h, trouver les 3 heures les moins chères de
demain, puis m'envoyer un message : _Recharge de la voiture de
{{start_time}} à {{end_time}}_ ».

## Widgets

- **Prix spot** — prix actuel (couleur selon le niveau), prix suivant,
  minimum et maximum du jour, courbe d'aujourd'hui et de demain avec un
  repère « maintenant », niveau, moyenne, meilleur créneau de 2 h.
- **Heures moins chères** — les meilleurs créneaux de 1, 2, 3 et 4 h des 24
  prochaines heures, et un bouton **Actualiser**.

## Dépannage

- **Pas de prix** : cliquez sur **Tester l'API des prix**. Un message
  « API injoignable » signale un problème réseau de Gladys ; « limite de
  requêtes » signale trop d'appels à l'API, l'intégration patiente 20 minutes.
- **Pas de prix de demain** : ils sont publiés vers 13 h (heure de Paris), et
  parfois plus tard lors d'un incident du marché.
- Les prix connus sont conservés dans le volume `/data` : un redémarrage ne
  les perd pas.

Source des données : Bundesnetzagentur | SMARD.de / energy-charts.info, sous
licence CC BY 4.0 (OMIE pour l'Espagne, usage privé).
