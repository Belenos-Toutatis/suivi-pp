#!/usr/bin/env python3
"""Fabrique test/fixtures/recap-mbn-invente.pdf : un faux « récapitulatif vie scolaire » de
Mon Bureau Numérique, à la MISE EN PAGE relevée sur le vrai (description masquée du
2026-10-09 : positions en mm depuis le haut à gauche, tailles en pt). Noms INVENTÉS — dépôt
public. Un élève sur deux pages (la suite sans en-tête), des cases sur deux lignes."""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

MM = 72 / 25.4
OUT = 'test/fixtures/recap-mbn-invente.pdf'
c = canvas.Canvas(OUT, pagesize=A4)
H = 297

def t(x, y, txt, size=7):
    c.setFont('Helvetica', size)
    c.drawString(x * MM, (H - y) * MM, txt)

def entete(nom, age_naiss, groupes, regime, sortie, n):
    t(33, 12, nom, 12)
    t(33, 17, age_naiss, 7)
    t(26, 22, '5C', 8); t(33, 22, 'Prof. principal M. ALPHA', 7)
    t(7, 31, 'Classe'); t(33, 31, '5C')
    t(7, 36, 'Groupes'); t(33, 36, groupes)
    t(7, 40, 'Régime de'); t(33, 40, regime); t(7, 43, '½ pension')
    t(7, 47, 'Régime de'); t(33, 47, sortie); t(7, 50, 'sortie')
    t(6, 64, 'Évènements du 1 sept. 2025 au 9 oct. 2025', 12)
    for x, s in zip((6, 46, 86, 126, 166), ('Absences', 'Retards', 'Observations', 'Punitions', 'Dispenses')): t(x, 73, s, 8)
    for x, s in zip((6, 46, 86, 126, 166), n): t(x, 76, s, 8)

def pied(p, n):
    t(5, 292, 'Édité le : 09/10/2025', 8); t(187, 292, f'Page {p} sur {n}', 8)

def tete_abs(y, titre):
    t(6, y, titre, 8)
    t(143, y + 5, 'Séances'); t(164, y + 5, 'Durée de')
    for x, s in zip((6, 53, 74, 121, 143, 164, 185), ('Période', 'Régularisé', 'Motif', 'Valable', 'impactées', 'séances', 'Comptabilisé')): t(x, y + 8, s)
    t(164, y + 11, 'manquées')

def ligne_abs(y, cells):
    for x, s in zip((6, 53, 74, 121, 143, 164, 185), cells):
        if s: t(x, y, s)

def tete_obs(y):
    t(6, y, 'Observations', 8)
    for x, s in zip((6, 34, 92, 149), ('Date', 'Motif', 'Type', 'Demandeur')): t(x, y + 5, s)

def tete_pun(y):
    t(6, y, 'Punitions', 8)
    for x, s in zip((6, 34, 77, 120, 163), ("Date de l'évènement", 'Conséquence', 'Motifs', 'État', 'Demandeur')): t(x, y + 5, s)

# ── 1. Noé MARTIN : une page, de tout ──
entete('Noé MARTIN', '12 ans - 14/03/2013', '5DE-CATHO, 5E-GP2', "DEMI-PENSIONNAIRE DANS L'ETABLISSEMENT", 'D2',
       ('2 demi-j. (5 h)', '1 retard', '2 observations', '1 punition', '0 dispense'))
tete_abs(137, 'Absences')
ligne_abs(153, ('Du 22/09/2025 08:00 au', '', '', '', '', '', ''))
ligne_abs(155, ('23/09/2025 17:00', 'Non', 'Raison de santé', 'Oui', '3', '3 h', 'Oui'))
t(74, 160, 'Absent en cours/présent dans')
ligne_abs(162, ('Le 29/09/2025, de 10:00 à 12:00', 'Oui', "l'établissement", 'Non', '2', '2 h', 'Oui'))
tete_abs(170, 'Retards')
ligne_abs(186, ('Le 01/10/2025, de 08:00 à 08:15', 'Non', 'Problèmes de transport', 'Oui', '1', '15 min', 'Oui'))
tete_obs(196)
for y, d, m in ((206, '9 sept. 2025', 'Travail non fait'), (211, '2 oct. 2025', 'Bavardage')):
    t(6, y, d); t(34, y, m); t(92, y, 'Négatif'); t(149, y, 'BETA Claire')
tete_pun(220)
t(6, 230, '18 sept. 2025'); t(34, 230, 'Retenue'); t(77, 230, 'Manquement au règlement'); t(120, 230, 'Réalisée'); t(163, 230, 'Vie scolaire')
t(77, 233, 'intérieur')
pied(1, 1); c.showPage()

# ── 2. Léa DUPONT : deux pages, la suite sans en-tête ──
entete('Léa DUPONT', '11 ans - 02/11/2013', '5E-GP1, 5E-DEVFAITS', 'EXTERNE LIBRE', 'D1',
       ('0 absence', '0 retard', '3 observations', '0 punition', '0 dispense'))
tete_obs(240)
for y, d, m, ty in ((250, '15 sept. 2025', 'Oubli de matériel', 'Négatif'), (255, '1 oct. 2025', 'Oubli de matériel', 'Négatif')):
    t(6, y, d); t(34, y, m); t(92, y, ty); t(149, y, 'GAMMA Paul')
pied(1, 2); c.showPage()
t(6, 20, '6 oct. 2025'); t(34, 20, 'Aide apportée à un camarade'); t(92, 20, 'Positif'); t(149, 20, 'GAMMA Paul')
pied(2, 2); c.showPage()

# ── 3. Jean-Marc DE LA TOUR : aucune observation, une dispense (non reprise) ──
entete('Jean-Marc DE LA TOUR', '12 ans - 30/06/2013', '5E-GP1', "DEMI-PENSIONNAIRE DANS L'ETABLISSEMENT", 'D3',
       ('0 absence', '0 retard', '0 observation', '0 punition', '1 dispense'))
t(106, 88, "Motifs d'observation", 8); t(106, 91, 'Aucune observation', 6)
tete_abs(130, 'Dispenses')
ligne_abs(146, ('Récurrence du 15/09/2025 au', '', '', '', '', '', ''))
ligne_abs(148, ('15/10/2025', 'Oui', 'Raison de santé', 'Oui', '4', '4 h', 'Oui'))
pied(1, 1); c.showPage()

# ── 4. Un élève qui n'est pas dans la classe ──
entete('Zoé INCONNUE', '12 ans - 01/01/2013', '5E-GP3', 'EXTERNE LIBRE', 'D1',
       ('0 absence', '0 retard', '1 observation', '0 punition', '0 dispense'))
tete_obs(100)
t(6, 110, '3 oct. 2025'); t(34, 110, 'Bavardage'); t(92, 110, 'Négatif'); t(149, 110, 'BETA Claire')
pied(1, 1); c.showPage()

# ── 5. Inès FAURE : deux pages, l'en-tête REDIT en page 2, le tableau des absences continue
#       directement par une rangée (sans ses en-têtes de colonnes) ──
def semaine():
    for x, j in zip((6, 46, 86, 126, 166), ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi')): t(x, 113, j, 8)
    t(6, 118, 'AB (M1) - 15 sept.', 6); t(46, 118, 'Aucun évènement', 6)
ENT5 = ('Inès FAURE', '12 ans - 05/05/2013', '5E-GP2', 'EXTERNE LIBRE', 'D1', ('3 demi-j. (9 h)', '1 retard', '0 observation', '0 punition', '0 dispense'))
entete(*ENT5); semaine()
tete_abs(137, 'Absences')
ligne_abs(153, ('Le 15/09/2025, de 08:00 à 12:00', 'Oui', 'Raison de santé', 'Oui', '4', '4 h', 'Oui'))
pied(1, 2); c.showPage()
entete(*ENT5); semaine()
ligne_abs(130, ('Le 06/10/2025, de 13:30 à 17:00', 'Non', 'Raison de santé', 'Oui', '3', '3 h 30 min', 'Oui'))
tete_abs(140, 'Retards')
ligne_abs(156, ('Le 07/10/2025, de 08:00 à 08:10', 'Oui', 'Problèmes de transport', 'Oui', '1', '10 min', 'Oui'))
pied(2, 2); c.showPage()

# ── 6. Hugo PETIT : deux pages, l'en-tête redit, et le tableau reprend par ses en-têtes de colonnes ──
ENT6 = ('Hugo PETIT', '13 ans - 20/12/2012', '5E-GP1', "DEMI-PENSIONNAIRE DANS L'ETABLISSEMENT", 'D2', ('2 demi-j. (6 h)', '0 retard', '1 observation', '0 punition', '0 dispense'))
entete(*ENT6); semaine()
tete_abs(137, 'Absences')
ligne_abs(153, ('Le 16/09/2025, de 08:00 à 11:00', 'Oui', 'Rendez-vous médical', 'Oui', '3', '3 h', 'Oui'))
pied(1, 2); c.showPage()
entete(*ENT6); semaine()
t(143, 127, 'Séances'); t(164, 127, 'Durée de')
for x, s_ in zip((6, 53, 74, 121, 143, 164, 185), ('Période', 'Régularisé', 'Motif', 'Valable', 'impactées', 'séances', 'Comptabilisé')): t(x, 130, s_)
t(164, 133, 'manquées')
ligne_abs(139, ('Le 30/09/2025, de 14:00 à 17:00', 'Non', 'Raison de santé', 'Non', '3', '3 h', 'Oui'))
tete_obs(150)
t(6, 160, '8 oct. 2025'); t(34, 160, 'Bavardage'); t(92, 160, 'Négatif'); t(149, 160, 'BETA Claire')
pied(2, 2); c.showPage()
c.save()
print(OUT)
