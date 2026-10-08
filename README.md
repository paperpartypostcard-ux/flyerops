# Flyer Distribution — MVP

Внутреннее веб-приложение для управления раздачей листовок по suburbs Мельбурна.
Стек: Next.js 15 + Tailwind · Supabase (Postgres + PostGIS, Auth, RLS) · MapLibre (тайлы OpenFreeMap) · Vercel.

## Что уже работает (итерация 1)

| Экран | Кто | Что делает |
|---|---|---|
| `/login` | все | вход по email + пароль |
| `/dashboard` | owner, manager | сводка за 7/30/90 дней: листовки (и сравнение с прошлым периодом), часы, листовок/час, районы, склад и на руках, проверки; график по дням; районы по статусам; таблицы по компаниям и раздатчикам. Средние листовки и часы в неделю/месяц, по компаниям в неделю/месяц, сумма выплат за период, рекомендации следующих районов (свободные; сначала никогда не пройденные или давно, затем по числу домов; фильтр «рядом с домом раздатчика»). Стартовая страница для staff |
| `/map` | owner, manager | карта всех suburbs с цветом статуса, поиск/фильтр, карточка района (жилища, цикл, последняя раздача, следующая допустимая дата, кто раздаёт), назначение раздатчика + компании, передача района другому, «завершено/отмена», настройки района (цикл 3/4 мес., ручная правка числа жилищ, исключение), красные линии — пройденные маршруты текущего цикла |
| `/walkers` | owner, manager | список раздатчиков со статистикой (листовки, часы, листовок/час, на руках), создание аккаунтов, деактивация |
| `/stock` | owner, manager | склад листовок по компаниям: приход, выдача раздатчику, возврат, корректировка; остатки на складе и на руках; журнал движений. Выдать больше, чем на складе, или принять возврат больше, чем на руках, база не даст |
| `/checks` | owner, manager | журнал проверок раздатчиков (видеозвонок / лично, pass/fail, заметки), процент успешных по каждому |
| `/payroll` | owner, manager | начисления раздатчикам за неделю / месяц / любой период: листовки × ставка ÷ 1000 (ставка $125, меняет только owner), итог к выплате, экспорт CSV |
| `/me` | walker | только свои районы на карте + что уже пройдено (без имён других), отчёт о прогулке: дата, листовки, часы, GPX-файл из Map My Walk, история своих прогулок, остаток листовок на руках |

Правила в базе (не обходятся из интерфейса):
- район получает листовки **от любой компании** не чаще одного раза за свой цикл — попытка назначить раньше отклоняется;
- на районе может быть только одно открытое назначение;
- walker видит только своё (проверено тестом `supabase/tests/rls_test.sql`);
- manager не может создавать/менять staff-аккаунты, только owner.

Следующие итерации: подсветка пройденных **улиц** (OSM), экспорт, API Map My Walk.

## Запуск — шаг за шагом

### 1. Supabase (аккаунт клиента)
1. https://supabase.com → New project, **Region: Sydney (ap-southeast-2)**.
2. SQL Editor → по очереди выполнить `supabase/migrations/0001_init.sql`, затем `0002_stock_checks.sql`, `0003_dashboard.sql`, `0004_payroll_recommend.sql`, `0005_inactive_guard.sql`.
3. Authentication → Sign In / Providers → Email: **выключить «Allow new users to sign up»** (аккаунты создаёт только менеджер).
4. Project Settings → API: скопировать URL, `anon` key, `service_role` key.

### 2. Локально
```bash
npm install
cp .env.example .env.local      # заполнить ключами
```

### 3. Загрузка suburbs Мельбурна
В `.env.local` добавьте `DATABASE_URL` (Project Settings → Database → Connection string → Session pooler), затем:
```bash
node --env-file=.env.local scripts/import-suburbs.mjs
```
Скрипт скачивает с abs.gov.au границы suburbs, границу Greater Melbourne и Census DataPack, оставляет только Greater Melbourne и проставляет число жилищ. Если скачивание не прошло — скрипт напечатает ссылки, файлы кладутся в папку `data/`.
Проверьте в выводе строку `Dwellings: using … → column "…"` — это колонка Census, из которой взято число жилищ.

### 4. Первый owner
Authentication → Users → Add user (email + пароль, Auto confirm). Затем в SQL Editor:
```sql
insert into profiles (id, full_name, email, role)
select id, 'Owner Name', email, 'owner' from auth.users where email = 'owner@example.com';
update companies set name = 'Реальное название компании' where name = 'Company A';
```
Вторую компанию: `insert into companies (name, color) values ('Second Co', '#16a34a');`

### 5. Запуск
```bash
npm run dev     # http://localhost:3000
```

### 6. Деплой
Vercel → Import GitHub repo → Environment Variables (те же три ключа, без DATABASE_URL) → **Functions region: Sydney (syd1)** → Deploy.

## Тесты базы
Нужен локальный Postgres с PostGIS:
```bash
createdb flyer_test
psql -d flyer_test -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_stock_checks.sql -f supabase/tests/rls_test.sql
createdb flyer_test2
psql -d flyer_test2 -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_stock_checks.sql -f supabase/tests/stock_checks_test.sql
```
Для дашборда аналогично с `0003_dashboard.sql` и `supabase/tests/dashboard_test.sql`.
Для финансов и рекомендаций — `0004_payroll_recommend.sql` и `supabase/tests/payroll_test.sql`.
Должно закончиться `ALL TESTS PASSED`, `ITERATION 2…4 TESTS PASSED`.

## Открытый вопрос
Две компании: сейчас район после раздачи **закрыт для обеих** до конца цикла (3/4 мес.). Если заказчик решит, что каждая компания считается отдельно, — правка одной функции `check_assignment_allowed`.
