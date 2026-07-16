# Plán zmien

Rozsiahla požiadavka — rozdelené do 4 oblastí. Prejdem ich všetky v jednom kole.

## 1. Raw mód – vylepšenia

**Aktuálny stav:** vľavo textarea, vpravo tabuľka pozorovaní s UT časom.

**Zmeny:**

- **Ľavý panel = editovateľný „raw list"**: každé existujúce pozorovanie s UT časom sa zobrazí ako jeden raw riadok (napr. `sscyga12v8.12215`). Riadky sa dajú:
  - editovať priamo (textarea zostáva zdrojom pravdy),
  - mazať (jednocho vymazaním riadku),
  - pridávať (Enter na novom riadku – ako doteraz).
  - Pri načítaní raw mdoe session sa textarea automaticky naplní existujúcimi riadkami ktoré majú ut čas ale ak tam nie sú žiadne také(nová session či uz z poslednej/oblúbenej alebo nová) tak to bdue proste prázdne.
- **Viac pozorovaní jednej hviezdy:** prefix `+` na začiatku riadku = ďalšie pozorovanie predošlej hviezdy v session, `++` = tretie atď. Príklad:
  ```
  sscyga12v8.12215
  +sscyg12v162247
  ++sscyg12v8.12320
  rxandave2230
  ```
  Uloží sa do `extraByStar` (existujúca štruktúra pre extra riadky).
- **Pravý panel** (tabuľka) zostáva, filter „len s UT časom" zachovaný.

## 2. Bug fix – názov session sa neukladá

Prejdem `SessionEditor.tsx` – over kedy sa `name` posiela do `supabase.update`, či sa neprepisuje pri autosave alebo pri refetchi. Fix + otestovať že sa objaví v `Sessions.tsx` zozname.

## 3. Nová cenotvorba

- Zmena z **denných** na **mesačné** limity AI skenov:
  - Free: **5/mesiac** (bolo 5/deň)
  - Plus: **40/mesiac** (bolo 15/deň)
- Cena Plus:
  - Mesačne: **eur2.99**
  - Ročne: **eurxx.xx/rok** (= eur1.95/mesiac, ~xx% zľava)
- Úpravy:
  - `paper-ocr` edge function: zmena okna z `used_on = today` na mesačný agregát (`YYYY-MM`).
  - Zobrazenie limitu v UI („X/5 tento mesiac").
  - Stripe: pridať ročný price cez `batch_create_product` (nový price ID `plus_yearly`), UI toggle mesačne/ročne na paywall obrazovke.

## 4. Milestone bonus – free Plus na 2 alebo 4 dni

Nová logika:

- **Trigger 2 dni Plus:** nový účet, alebo prekročenie 10 / 900 / 1000 / 1500 / 5000 / 10000 pozorovaní.
- **Trigger 4 dni Plus:** prekročenie 50 / 120 / 500 session.
- **Opakovanie:** po vyčerpaní cyklu (posledný milník) sa milníky resetujú a začínajú odznova (nový bonus za ďalších 10 pozorovaní atď.).
- Uvítací info banner (dismissable) na Sessions stránke: „Dostal si N dní Plus zadarmo za dosiahnutie X pozorovaní/session!".
- PS: v nastaveniach nová sekica milníky kde všetky dosiahnuté vidno.

**Technicky:**

- Nová tabuľka `plus_bonuses` (user_id, granted_at, expires_at, reason, milestone_key) + `milestone_progress` stĺpec v `profiles` (JSONB s posledným splneným milníkom v každej kategórii + počet cyklov).
- Trigger funkcia `check_and_grant_bonus(_user_id)` volaná po INSERT do `observations` a `sessions` (AFTER INSERT trigger).
- `has_active_bonus(_user_id)` helper → doplniť do `user_storage_limit_bytes` a `has_active_subscription` logiky, aby bonus dával Plus práva.
- Nový hook `usePlusStatus()` alebo rozšírenie `useSubscription()`: `isPlusActive = subscription || bonus`.
- Banner komponent + state v profile („welcome_bonus_seen": bool).

## 5. Testing / bug sweep

Po implementácii:

- prejsť `psql`om observations/sessions/subscriptions per user či všetko sedí,
- spustiť build a existujúce testy,
- vizuálne otestovať cez Playwright: raw mode edit/delete/`+` prefix, milestone banner, mesačný limit, ročný toggle na paywall.

## Poradie práce

1. Fix bug s ukladaním názvu session (rýchle).
2. Raw mód – ľavý panel editovateľný + `+` prefix.
3. Backend: migrácia (`plus_bonuses`, `milestone_progress`, triggery, helper), zmena `paper-ocr` na mesačné.
4. Frontend: hook, banner, paywall toggle.
5. Stripe: pridať ročný produkt.
6. Test sweep.