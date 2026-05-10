# Nordisk Hår — Bookingsystem
## Afsluttende Eksamensprojekt

**Dato:** 07/maj/2025  
**[Studerendes Navn]:** [Dit navn]  
**[Studerendes E-mail]:** [Din e-mail]  

**Institution:** UCL Erhvervsakademi og Professionshøjskole  
**Uddannelse:** IT Teknolog  
**Antal tegn:** [Udfyldes til sidst]  
**Vejleder:** [Vejleders navn]  

---

## Abstract

This report documents the design and development of a full-stack web-based appointment booking system for the fictional haircut salon "Nordisk Hår". The system enables customers to create accounts, verify their identity via email, and book appointments online. A role-based admin panel gives the salon owner full control over bookings, with real-time synchronisation to Google Calendar.

The problem addressed is the inefficiency and error-prone nature of manual appointment management in small service businesses. The goal was to deliver a secure, containerised, and deployable production system.

The system is built on a three-tier architecture: a React 18 frontend, a Node.js/Express REST API backend, and a PostgreSQL database — all orchestrated with Docker Compose and deployed to a Linux VM via a GitHub Actions CI/CD pipeline. Security was a primary concern, leading to implementation of JWT authentication with httpOnly cookies, bcrypt password hashing, email verification, rate limiting, parameterised SQL queries, Fail2ban, and HTTPS via Let's Encrypt.

Key theories applied include REST architectural principles, OWASP Top 10 security guidelines, and the MoSCoW prioritisation method for requirements engineering.

The result is a fully operational system accessible over HTTPS, with automated deployment, audit logging, and an admin dashboard — fulfilling all functional and non-functional requirements defined at project start.

---

## Indholdsfortegnelse

1. Abstract
2. Indholdsfortegnelse
3. Introduktion
4. Problemformulering
5. Kravspecifikation
6. Systemarkitektur
7. Databasedesign
8. Autentifikation og autorisation
9. Backend-udvikling og API
10. Frontend-udvikling
11. Sikkerhed
12. CI/CD og deployment
13. Google Calendar-integration
14. Test
15. Brug af kunstig intelligens
16. Konklusion
17. Litteraturliste

---

## 1. Introduktion

Mange små servicevirksomheder, såsom frisørsaloner, håndterer bookinger manuelt via telefon eller SMS. Dette er tidskrævende, fejlbehæftet og skalerer dårligt. Kunder kan heller ikke se ledige tider uden at kontakte salonen direkte, hvilket skaber friktion i hverdagen.

Dette projekt løser dette problem ved at udvikle et fuldt fungerende online bookingsystem for frisørsalonen "Nordisk Hår". Systemet giver kunder mulighed for at oprette en konto, bekræfte deres e-mail og booke tider online — alt sammen uden at kontakte salonen. Salonens ejer får et administrationspanel, hvorfra alle bookinger kan ses og administreres, og nye bookinger synkroniseres automatisk til Google Kalender.

Projektet er gennemført som et afsluttende eksamensprojekt på IT Teknolog-uddannelsen ved UCL og repræsenterer en fuld produktionsklar løsning, inklusiv sikkerhed, containerisering og automatiseret deployment.

---

## 2. Problemformulering

> **Hvordan kan der udvikles et sikkert, brugervenligt og driftklart online bookingsystem til en frisørsalon, der understøtter kundeoprettelse med e-mailverifikation, rollebaseret adgangskontrol og automatisk synkronisering med Google Kalender — og som kan deployeres i et containeriseret miljø med automatiseret CI/CD?**

Underspørgsmål:
- Hvilke sikkerhedsforanstaltninger er nødvendige for at beskytte en webapplikation i produktion?
- Hvordan designes en REST API, der håndterer autentifikation, autorisering og dataintegritet?
- Hvordan kan Docker og GitHub Actions bruges til at sikre reproducerbare deployments?

---

## 3. Kravspecifikation

Kravspecifikationen er udarbejdet med MoSCoW-metoden¹, som prioriterer krav i kategorierne *Must have*, *Should have*, *Could have* og *Won't have*.

### Tabel 1: Funktionelle krav (MoSCoW)

| Prioritet     | Krav                                                                 |
|---------------|----------------------------------------------------------------------|
| Must have     | Kunder kan oprette konto og logge ind                                |
| Must have     | E-mailverifikation ved kontooprettelse                               |
| Must have     | Kunder kan se ydelser og booke ledige tider                          |
| Must have     | Admin kan se og administrere alle bookinger                          |
| Must have     | Data gemmes persistent i en database                                 |
| Should have   | Automatisk synkronisering til Google Kalender                        |
| Should have   | Audit log over alle vigtige handlinger                               |
| Should have   | Systemet er tilgængeligt over HTTPS i produktion                     |
| Could have    | Rollebaseret adgang for medarbejdere (ikke kun admin)                |
| Could have    | Kunde kan se og annullere egne bookinger                             |
| Won't have    | Betalingsintegration (f.eks. Stripe)                                 |
| Won't have    | Mobilapp                                                             |

### Tabel 2: Ikke-funktionelle krav

| Kategori        | Krav                                                                |
|-----------------|---------------------------------------------------------------------|
| Sikkerhed       | Adgangskoder hashes med bcrypt (cost factor 10)                     |
| Sikkerhed       | JWT-tokens lagres i httpOnly cookies (ikke localStorage)            |
| Sikkerhed       | Alle SQL-forespørgsler er parameteriserede                           |
| Sikkerhed       | Rate limiting på auth-endpoints (5 forsøg/time)                    |
| Ydeevne         | API svarer inden for 500 ms under normal belastning                 |
| Driftsikkerhed  | Systemet kan deployeres reproducerbart med Docker Compose           |
| Vedligeholdelse | Kode er struktureret i tydelige lag (frontend/backend/database)     |

---

## 4. Systemarkitektur

Systemet er bygget på en klassisk tre-lagsarkitektur²:

```
[Browser / React SPA]
         |
         | HTTPS (nginx reverse proxy + Let's Encrypt SSL)
         |
[Node.js / Express REST API]
         |
         | TCP/5432
         |
[PostgreSQL database]
```

Alle tre lag kører i Docker-containere og orkestreres med Docker Compose. I produktion sker al kommunikation fra brugeren over HTTPS via en nginx reverse proxy, som videresender API-kald til backend-containeren og serverer den statiske React-applikation direkte.

### Figur 1: Komponentdiagram — [Indsæt diagram her]

*(Anbefaling: Lav et simpelt diagram i draw.io med fire bokse: Browser → nginx → Express API → PostgreSQL, med Docker Compose som "kasse" rundt om de tre servere)*

### Teknologistack

| Komponent        | Teknologi                  | Begrundelse                                        |
|------------------|----------------------------|----------------------------------------------------|
| Frontend         | React 18                   | Komponentbaseret, stor community, hurtig UI        |
| Backend          | Node.js + Express          | Let at sætte op, velegnet til REST APIs            |
| Database         | PostgreSQL                 | Robust, ACID-kompatibel, fremragende JSON-support  |
| Web server       | nginx                      | Høj ydeevne, velegnet som reverse proxy            |
| Containerisering | Docker + Docker Compose    | Reproducerbare miljøer, nem deployment             |
| CI/CD            | GitHub Actions             | Integreret i GitHub, gratis for offentlige repos   |
| E-mail           | Resend API                 | Moderne e-mail-API med simpel integration          |
| Kalender         | Google Calendar API v3     | Bred adoption, veldokumenteret API                 |

---

## 5. Databasedesign

Databasen er designet i PostgreSQL og initialiseres via `init.sql` ved første opstart. Der er fire primære tabeller.

### Figur 2: ER-diagram — [Indsæt ER-diagram her]

*(Anbefaling: Lav ER-diagram med draw.io eller dbdiagram.io med tabellerne customers, appointments, services og audit_logs og relationerne imellem dem)*

### Tabel 3: Tabelbeskrivelse

| Tabel          | Formål                                                              |
|----------------|---------------------------------------------------------------------|
| `services`     | Indeholder salonens ydelser (navn, varighed, pris)                  |
| `customers`    | Kundernes kontooplysninger inkl. hashed adgangskode og verif.-token |
| `appointments` | Bookinger med reference til kunde, ydelse, dato og tidslot          |
| `audit_logs`   | Logning af vigtige hændelser (oprettelse, login, ændringer)         |

Relationen mellem `appointments` og `services` er en mange-til-en-relation (mange bookinger kan have samme ydelse). `audit_logs` har en optional foreign key til `customers`, der sættes til NULL ved sletning (`ON DELETE SET NULL`), så audit-historikken bevares selvom en konto slettes.

Databasen er indekseret på de hyppigst forespurgte kolonner for at sikre god ydeevne:

```sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity       ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id      ON audit_logs(user_id);
```

---

## 6. Autentifikation og autorisation

Systemet understøtter to brugerroller: **kunde** og **administrator**. Administratorrollen tildeles baseret på en specifik e-mailadresse konfigureret i miljøvariablen `ADMIN_EMAIL`. Fremadrettet er der planlagt en egentlig medarbejderrolle.

### Autentifikationsflow

1. Kunden opretter konto via `POST /api/customers/register`
2. Adgangskoden hashes med `bcrypt` (cost factor 10) og gemmes i databasen
3. En tilfældig 8-cifret hex-kode genereres og sendes til kundens e-mail via Resend API
4. Kunden bekræfter koden via `POST /api/auth/verify`
5. Ved succesfuld bekræftelse udstedes et JWT-token (7 dages gyldighed) og sættes som `httpOnly` cookie

```
[Register] → [Verify Email] → [Login] → [JWT Cookie] → [Protected routes]
```

### JWT og httpOnly cookies

JWT-tokenet lagres i en `httpOnly` cookie (ikke i `localStorage` eller `sessionStorage`). Dette er en bevidst sikkerhedsbeslutning, da `httpOnly` cookies ikke kan tilgås af JavaScript i browseren, og dermed er beskyttet mod XSS-angreb (Cross-Site Scripting)³.

Token-payload indeholder: bruger-ID, navn, e-mail, `isAdmin`-flag og `isVerified`-flag.

### Autorisationsmiddleware

Tre middleware-funktioner beskytter API-endpoints:

- `requireAuth` — validerer JWT-tokenet
- `requireAdmin` — kræver at `isAdmin` er `true` i token-payload
- `requireVerifiedCustomer` — kontrollerer at kundens e-mail er bekræftet i databasen

```
POST /api/appointments  →  requireAuth  →  requireVerifiedCustomer  →  handler
GET  /api/admin/*       →  requireAuth  →  requireAdmin             →  handler
```

---

## 7. Backend-udvikling og API

Backend er implementeret med Node.js og Express og eksponerer en RESTful API. Alle endpoints følger HTTP-standarderne for metoder og statuskoder.

### Tabel 4: API-oversigt

| Metode | Endpoint                         | Auth          | Beskrivelse                          |
|--------|----------------------------------|---------------|--------------------------------------|
| GET    | `/api/health`                    | Ingen         | Health check                         |
| GET    | `/api/services`                  | Ingen         | Hent alle ydelser                    |
| GET    | `/api/availability/:date`        | Ingen         | Hent booket tidslots for en dato     |
| POST   | `/api/customers/register`        | Ingen         | Opret kundekonto                     |
| POST   | `/api/auth/verify`               | Ingen         | Bekræft e-mail med kode              |
| POST   | `/api/login`                     | Ingen         | Log ind                              |
| POST   | `/api/logout`                    | Ingen         | Log ud (ryd cookie)                  |
| GET    | `/api/me`                        | requireAuth   | Hent aktuel bruger                   |
| POST   | `/api/appointments`              | Auth + Verified| Opret booking                       |
| GET    | `/api/admin/appointments`        | Admin         | Hent alle bookinger                  |
| PATCH  | `/api/admin/appointments/:id`    | Admin         | Opdater bookingstatus                |
| GET    | `/api/admin/system-status`       | Admin         | Docker og backup VM-status           |
| GET    | `/api/admin/backup/logs`         | Admin         | Vis backup-logs                      |

### SQL Injection-beskyttelse

Alle databaseforespørgsler benytter parameteriserede statements ($1, $2, ...) via `pg`-biblioteket. Ingen brugerinput interpoleres direkte i SQL-strenge.

```javascript
// Eksempel på parameteriseret query
const result = await pool.query(
  'SELECT id FROM customers WHERE email = $1',
  [email]
);
```

### Structured logging

Backend benytter Winston til struktureret JSON-logging med separate filer til `combined.log` og `error.log`. Logs roteres dagligt og er tilgængelige for admin-brugeren via API'et.

---

## 8. Frontend-udvikling

Frontend er en Single Page Application (SPA) bygget i React 18, der kommunikerer med backend via HTTP-kald. Den statiske applikation bygges under CI/CD og serveres af en nginx-container i produktion.

### Komponentstruktur

```
App.js
├── Header.js          — Navigation og login/logout-knapper
├── ServiceCard.js     — Visning af ydelse (navn, pris, varighed)
├── BookingForm.js     — Kalender, tidsvælger og bookingformular
├── AdminDashboard.js  — Oversigt over bookinger (admin-only)
└── VerifyEmailModal.js — Pop-up til e-mailbekræftelse
```

Frontend beskytter admin-ruter klient-sidebaseret via `isAdmin`-flaget returneret fra `/api/me`. Da sessionen gendannes fra en `httpOnly` cookie, vedligeholdes login-tilstand automatisk på tværs af browser-genindlæsninger.

### Figur 3: Skærmbillede af bookingformular — [Indsæt screenshot her]

### Figur 4: Skærmbillede af admin-dashboard — [Indsæt screenshot her]

### Responsivt design

Applikationen er fuldt responsiv og fungerer på mobile enheder, tablets og desktop. Farvepalet er baseret på jordnære grønne toner (Sage Green `#6b9f78`, Mint Green `#a8d5ba`), der understøtter salonens æstetik.

---

## 9. Sikkerhed

Sikkerhed er behandlet systematisk med udgangspunkt i OWASP Top 10⁴, som identificerer de mest kritiske sikkerhedsrisici i webapplikationer.

### Tabel 5: OWASP Top 10 — projektets mitigationer

| OWASP Risiko                       | Implementeret mitigation                                              |
|------------------------------------|-----------------------------------------------------------------------|
| A01 – Broken Access Control        | `requireAuth` / `requireAdmin` middleware på alle beskyttede endpoints|
| A02 – Cryptographic Failures       | bcrypt (cost 10) til adgangskoder, HTTPS via Let's Encrypt            |
| A03 – Injection                    | Alle SQL-queries parameteriserede (ingen string interpolation)        |
| A05 – Security Misconfiguration    | CORS konfigureret til kun at tillade kendte origins                   |
| A07 – Identification & Auth        | JWT httpOnly cookies, e-mailverifikation, rate limiting               |
| A09 – Security Logging             | Audit log for alle vigtige handlinger, Winston til server-logs        |

### Rate limiting

To separate rate limiters beskytter API'et:

- **General limiter:** 100 forespørgsler per 15 minutter (alle `/api`-endpoints)
- **Auth limiter:** 5 forsøg per time (login og e-mailverifikation)

### Fail2ban

Serveren kører Fail2ban, der automatisk blokerer IP-adresser, der genererer mange 4xx-fejl mod nginx. Dette beskytter mod automatiserede scannere og brute force-angreb.

### Audit log

`AuditService`-klassen logger alle vigtige handlinger til tabellen `audit_logs`:

| Action                        | Beskrivelse                                    |
|-------------------------------|------------------------------------------------|
| `CUSTOMER_REGISTERED`         | Ny konto oprettet                              |
| `CUSTOMER_VERIFIED`           | E-mail bekræftet                               |
| `LOGIN_SUCCESS`               | Succesfuldt login                              |
| `APPOINTMENT_CREATED`         | Ny booking oprettet                            |
| `APPOINTMENT_STATUS_UPDATED`  | Admin har ændret bookingstatus                 |
| `GOOGLE_EVENT_CREATE_SUCCESS` | Google Kalender-event oprettet                 |
| `GOOGLE_EVENT_DELETE_SUCCESS` | Google Kalender-event slettet                  |

Audit loggen indeholder: tidsstempel, bruger-ID, IP-adresse, den berørte entitet samt old/new values i JSONB-format.

---

## 10. CI/CD og deployment

Projektet benytter en fuldt automatiseret CI/CD-pipeline via GitHub Actions, der trigges ved push til `main`-branchen.

### Figur 5: CI/CD flow — [Indsæt diagram her]

### Pipeline-trin

1. **Checkout** kodebasen
2. **Byg og push** Docker-images til GitHub Container Registry (ghcr.io)
3. **Opret `.env`** fra GitHub Secret `ENV_FILE`
4. **Kopiér filer** til produktions-VM via SCP (docker-compose.prod.yml, nginx.conf, website/)
5. **Valider miljøvariabler** på VM (script fejler hvis påkrævede variabler mangler)
6. **Pull og start** containere med `docker compose up -d --remove-orphans`

### Tabel 6: GitHub Secrets

| Secret              | Formål                                        |
|---------------------|-----------------------------------------------|
| `ENV_FILE`          | Hele `.env`-filen til produktion               |
| `VM_HOST`           | IP/hostname på produktionsserveren             |
| `VM_USER`           | SSH-bruger                                    |
| `VM_SSH_KEY`        | SSH-privat nøgle                              |
| `VM_PROJECT_PATH`   | Sti på VM (f.eks. `/root/apps`)               |

### Produktionsmiljø

- **Web server:** nginx (reverse proxy + statisk filservering)
- **SSL:** Let's Encrypt via Certbot, automatisk fornyelse
- **Backup:** Nightly backup-script med log tilgængeligt via admin-panelet
- **Google Calendar:** Integreret via Service Account med begrænset scope (`calendar.events`)

---

## 11. Google Calendar-integration

Når en kunde booke en tid, oprettes automatisk et event i salonens Google Kalender via Google Calendar API v3. Integrationen håndteres af `GoogleCalendarService`-klassen og kan aktiveres/deaktiveres via miljøvariablen `GOOGLE_CALENDAR_ENABLED`.

**Autentifikation** sker via en Google Service Account med JWT-autentifikation, der kun har adgang til `calendar.events`-scopet — ikke hele kalenderen.

Hvert event indeholder:
- Sammendrag: `[Ydelse] - [Kundenavn]`
- Beskrivelse: Kundenavn, e-mail, telefon og booking-ID
- Start- og sluttidspunkt beregnet ud fra ydelsens varighed
- `extendedProperties` med booking-ID til referencebrug

Sync-status spores i `appointments`-tabellen (`google_sync_status`: `pending`, `synced`, `failed`, `cancelled`, `disabled`). Fejl logges separat og vises i audit-loggen.

---

## 12. Test

### Manuel test

Systemet er testet manuelt gennem hele udviklingsforløbet. Følgende test-cases er gennemført:

### Tabel 7: Test-cases

| Test case                              | Forventet resultat                                  | Resultat  |
|----------------------------------------|-----------------------------------------------------|-----------|
| Opret konto med ugyldig e-mail         | 400 Bad Request med fejlbesked                      | Bestået   |
| Opret konto med eksisterende e-mail    | 409 Conflict                                        | Bestået   |
| Login med forkert adgangskode          | 401 Unauthorized                                    | Bestået   |
| Book tid uden at være logget ind       | 401 Unauthorized                                    | Bestået   |
| Book tid med ubekræftet e-mail         | 403 Forbidden med `NOT_VERIFIED`-kode               | Bestået   |
| Book samme tid to gange                | 409 Conflict                                        | Bestået   |
| Admin tilgår `/api/admin/*`            | 200 OK med data                                     | Bestået   |
| Ikke-admin tilgår `/api/admin/*`       | 403 Forbidden                                       | Bestået   |
| Rate limit på login (6. forsøg)        | 429 Too Many Requests                               | Bestået   |
| Google Kalender-sync ved ny booking    | Event oprettet i kalender, status = 'synced'        | Bestået   |

### Begrænsninger

Der er ikke skrevet automatiserede unit-tests eller integrationstests. Dette er en known limitation, der anbefales adresseret i en fremtidig iteration.

---

## 13. Brug af kunstig intelligens

I overensstemmelse med UCLs retningslinjer for brug af AI-teknologier⁵ redegøres her for brugen af AI-værktøjer i projektet.

**Anvendt AI-værktøj:** Cursor IDE med Claude Sonnet (Anthropic)

**Hvad AI er brugt til:**
- Generering af boilerplate-kode (Docker Compose-konfiguration, nginx-konfiguration)
- Debugging af fejl og forklaring af fejlbeskeder
- Forslag til struktur på middleware-lag og service-klasser
- Sparring om sikkerhedsimplementeringer (f.eks. valg af httpOnly cookies over localStorage)

**Hvad AI IKKE er brugt til:**
- Alle arkitekturelle beslutninger er truffet selvstændigt
- Forståelsen af de anvendte teknologier og biblioteker er tilegnet via dokumentation og egne eksperimenter
- Rapporten er skrevet selvstændigt

AI-assistancen har øget produktiviteten, men alle beslutninger om teknologivalg, sikkerhedsdesign og systemarkitektur er truffet og begrundet af projektstuderende.

---

## 14. Konklusion

Projektet har resulteret i et fuldt funktionelt og produktionsklar bookingsystem til frisørsalonen "Nordisk Hår". Systemet lever op til de definerede krav:

- Kunder kan oprette og verificere konti og booke tider online
- Admin-brugeren har fuld kontrol via et dedikeret dashboard
- Nye bookinger synkroniseres automatisk til Google Kalender
- Systemet er sikret mod de mest kritiske webtrusler (OWASP Top 10)
- Deployment er fuldt automatiseret via GitHub Actions og Docker

**Uopfyldte krav (Could have):**
Rollebaseret adgang for medarbejdere (udover administrator) er ikke implementeret i den afleverede version. Kunder kan endvidere ikke annullere egne bookinger via frontend-grænsefladen. Disse punkter er identificeret til en fremtidig version.

**Teknisk læring:**
Projektet har givet dybdegående erfaring med full-stack webudvikling, containerisering med Docker, CI/CD med GitHub Actions, og implementering af sikkerhed i webapplikationer. Særligt arbejdet med JWT-autentifikation, bcrypt og OWASP-mitigationer har givet konkret erfaring med produktionsklar sikkerhed.

**Fremtidigt arbejde:**
- Medarbejderrolle med begrænset admin-adgang
- Kunde-selvbetjening: vis og annuller egne bookinger
- Automatiserede integrationstest (f.eks. Jest + Supertest)
- Push-notifikationer til kunder ved aflyste tider

---

## Litteraturliste

¹ Clegg, D., & Barker, R. (1994). *Case Method Fast-Track: A RAD Approach*. Addison-Wesley. (MoSCoW-metoden)

² Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley. (Tre-lagsarkitektur)

³ OWASP Foundation. (2021). *OWASP Top 10: A02 – Cryptographic Failures*. https://owasp.org/Top10/A02_2021-Cryptographic_Failures/

⁴ OWASP Foundation. (2021). *OWASP Top 10*. https://owasp.org/Top10/

⁵ UCL Erhvervsakademi og Professionshøjskole. (2024). *Retningslinjer for brug af AI-teknologier*. [Indsæt intern reference/link]

⁶ Docker Inc. (2024). *Docker Compose documentation*. https://docs.docker.com/compose/

⁷ GitHub Inc. (2024). *GitHub Actions documentation*. https://docs.github.com/en/actions

⁸ Google LLC. (2024). *Google Calendar API v3 documentation*. https://developers.google.com/calendar/api/v3/reference

⁹ Auth0 / Okta. (2024). *JWT Introduction*. https://jwt.io/introduction

¹⁰ npm: bcryptjs. (2024). https://www.npmjs.com/package/bcryptjs

---

*Antal tegn (inkl. mellemrum): [Udfyldes til sidst med Word's tegnoptælling — Gennemse → Ordtælling → Tegn inkl. mellemrum]*
