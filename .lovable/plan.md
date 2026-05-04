
# Reducciones — webová appka pre pozorovania premenných hviezd

Plnohodnotná náhrada ODS tabuľky: editovateľný katalóg hviezd, zápis pozorovania s automatickým výpočtom magnitúdy a JD, navigácia po súhvezdiach (linky ako na obrázku), predvyplnenie zo šablóny poslednej session a export troch hlásení (VSNET, AAVSO, MEDUZA) ako samostatné súbory na stiahnutie.

## Prihlásenie
- Email + heslo (Lovable Cloud auth). Jeden užívateľ, ale registrácia/login sú zapnuté.
- Po prihlásení sa pri prvom použití naimportuje katalóg hviezd a posledná session z nahraného ODS súboru (`Reducciones2604.ods`) do databázy užívateľa.

## Hlavná obrazovka — Sessions
- Zoznam uložených sessions (dátum, UT, počet zapísaných hviezd, JD).
- Tlačidlo **Nová session** → vytvorí kópiu poslednej session ako šablónu:
  - hlavička (dátum, UT, JD) sa posunie na „teraz“,
  - hodnoty hviezd (A, Pasos A, Pasos B, B, „<=", nota) sa prevezmú z poslednej session,
  - užívateľ upraví len to, čo sa zmenilo.
- Akcie pri session: otvoriť, duplikovať, zmazať, exportovať.

## Editor session
Hlavička (editovateľná, JD sa prepočítava automaticky):
- Dátum (UT), Hora (UT) → JD (kompletný a desatinné dni)
- Fecha de Referencia (default 01/01/1980)

Pod hlavičkou navigácia presne podľa obrázku — dva riadky liniek:

```text
AND   CAS   CAM   UMA   HER   DRA           CYG
ORI   GEM   LEO   AQL   SGE   PEGASUS
VISUAL   BINAR   ECL faint        ECL bright
```

- Linky súhvezdí scrollujú/filtrujú na danú sekciu hviezd.
- Druhý riadok (VISUAL / BINAR / ECL faint / ECL bright) filtruje typ hviezdy.
- Aktívny link je zvýraznený, navštívené tmavšou farbou (ako na obrázku).

Pre každé súhvezdie tabuľka hviezd so stĺpcami:
- Hviezda · A · Pasos A · Pasos B · B · `< / =` · UT · `:` · Nota
- Vypočítané (read-only): VSNET kód a magnitúda, AAVSO riadok, MEDUZA riadok, JD
- Indikátor stavu (vyplnené / limit / prázdne / chyba ako #DIV/0!).

Vzorec magnitúdy: `mag = A + (Pasos A / (Pasos A + Pasos B)) * (B − A)`, zaokrúhlené na 2 desatinné. Pri vyplnenom „<=" sa zapisuje limit (napr. `<14.9`). Validácie ošetria delenie nulou (žiadne #DIV/0! v exporte).

## Katalóg hviezd (editovateľný)
Samostatná stránka **Katalóg**:
- CRUD nad hviezdami: pridať, premenovať, zmazať, presunúť medzi súhvezdiami, zmeniť typ (VISUAL/BINAR/ECL faint/ECL bright).
- Polia: názov, súhvezdie, typ, kód VSNET, kód AAVSO, ID karty (chart), poznámka.
- Hromadný import/export katalógu (CSV) pre zálohu.
- Pri importe z ODS sa katalóg založí raz; ďalej je plne editovateľný.

## Exporty (na konci session)
Tri tlačidlá → každé stiahne **samostatný textový súbor**, presne v rovnakých formátoch ako v ODS:
- `vsnet_YYYYMMDD.txt` — riadky `KÓD YYYYMMDD.000 mag OBS`
- `aavso_YYYYMMDD.txt` — AAVSO Visual File Format (hlavička `#TYPE=Visual`, `#OBSCODE=`, `#SOFTWARE=`, `#DELIM=,`, `#DATE=JD`, `#OBSTYPE=Visual`) + riadky `Estrella,JD,Mag,Comm,Comp1,Comp2,Carta,Notas`
- `meduza_YYYYMMDD.txt` — `Estrella,JD,Mag,Fecha UT,Obs,Estima`

Pri každom exporte sa preskakujú prázdne / chybné riadky. Tlačidlo **Náhľad** ukáže text pred stiahnutím a má aj „Kopírovať do schránky".

## Drobnosti
- Kód observátora (OBS, default `DPV`) je v profile užívateľa, mení sa v Nastaveniach.
- Uložiť sa dá kedykoľvek; auto-save každých pár sekúnd.
- Mobile-friendly tabuľka (horizontálny scroll + sticky názov hviezdy).

## Technické detaily
- Stack: React + Vite + Tailwind + shadcn/ui, React Router.
- Lovable Cloud (Supabase) — auth (email+heslo) a databáza s RLS na `user_id`.
- Tabuľky:
  - `profiles` (user_id, obs_code, fecha_referencia)
  - `stars` (id, user_id, name, constellation, type, vsnet_code, aavso_code, chart_id, notes, sort_order)
  - `sessions` (id, user_id, observed_at_utc, jd, created_at)
  - `observations` (id, session_id, star_id, a, pasos_a, pasos_b, b, limit_value, ut_time, note)
- JD prepočet a vzorce magnitúdy v čistých TS utilitách (`src/lib/astro.ts`) + unit testy.
- Generátory exportov v `src/lib/exporters/{vsnet,aavso,meduza}.ts`, sťahované cez Blob.
- Jednorazový import z `Reducciones2604.ods` cez tlačidlo „Importovať katalóg z ODS" v Nastaveniach (parsovanie cez `xlsx` knižnicu, hviezdy + posledná session sa zapíšu do DB).

## Mimo rozsahu (môžeme pridať neskôr)
- Viac užívateľov so zdieľaním sessions.
- Grafy svetelných kriviek hviezdy v čase.
- Priame odoslanie hlásenia do VSNET/AAVSO emailom.
