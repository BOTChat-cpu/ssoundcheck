# SSoundCheck

Музыкальный сайт https://ssoundcheck.ru на независимом сервере Beget.

## Разработка

Node.js >=22.13. Установка: `npm install`. Сборка: `npm run build`. Инициализация локальной SQLite: `npm run db:migrate`. Для входа нужны переменные BETTER_AUTH_URL и BETTER_AUTH_SECRET в локальном .env.local; секрет генерируется отдельно и не публикуется.

## Обновления сервера

После однократной установки `scripts/beget/setup-updates.sh` сервер проверяет ветку main примерно раз в минуту. Новая версия собирается отдельно, затем применяются миграции и перезапускается приложение. При ошибке запуска восстанавливается предыдущая версия и резервная копия базы. Сборка выполняется без прав root.

Конфигурация Nginx, HTTPS, секреты и база пользователей при обновлении сохраняются. Первоначальный `install.sh` предназначен только для нового сервера и не применяется при обновлениях.

Данные находятся в /srv/ssoundcheck/data, секреты — в /etc/ssoundcheck.env, резервные копии — в /srv/ssoundcheck/backups. Эти каталоги и файлы не входят в репозиторий.

Код публично доступен для ознакомления; лицензия, разрешающая повторное использование, не предоставлена.

## Панель управления

Адрес: `/admin`. После обновления задайте отдельный пароль командой `bash /srv/ssoundcheck/current/scripts/beget/setup-admin.sh` в консоли VPS. Пароль вводится скрыто, в GitHub не попадает. Эта же команда меняет пароль и завершает действие прежних сессий. Для смены пароля нужна консоль сервера.

Панель позволяет публиковать, скрывать, исправлять и удалять отзывы, менять услуги, цены, тексты первого экрана и раздела «О проекте», ссылку Telegram, добавлять и заменять MP3 до 20 МБ. Новые отзывы проходят модерацию, ранее опубликованные сохраняются. Настройки, отзывы, сессии и загрузки хранятся вне каталога релиза. Заявки отправляются через форму сайта и сохраняются в базе. В панели «Заявки» доступны контакты клиента, пожелания, согласованная стоимость и статус работы. Новая заявка требует входа в обычный аккаунт сайта. Онлайн-оплата пока не подключена.

Проверка после сборки: `node scripts/admin-integration.mjs`. Тест использует временную SQLite, проверяет миграции, защиту панели, отзывы, настройки, MP3 и авторизацию; рабочая база не затрагивается.

Повторная отправка с тем же идентификатором возвращает уже сохранённую заявку; стоимость берётся из текущих настроек сайта. Контакт и история доступны только владельцу заявки и администратору.

## Частные песни и фрагменты

В панели «Заявки» можно загрузить полную MP3 до 20 МБ и выбрать начало 40-секундного фрагмента. На VPS один раз выполните `bash /srv/ssoundcheck/current/scripts/beget/setup-order-media.sh` от root для установки ffmpeg/ffprobe. Клиенту выдаётся отдельный M4A продолжительностью ровно 40 секунд; исходный MP3 хранится рядом с SQLite в закрытом каталоге orders, вне public и релизов. Прослушивание требует аккаунт владельца заявки. Полный файл доступен владельцу только при наличии подтверждённой сервером оплаты. Платёжный провайдер пока не подключён; пользователь или администратор не могут выставить paid_at через API.

## Manual bank transfers

Configure recipient, bank and transfer details under Admin → Orders → Payment by transfer. Disabled by default. Details are stored in the private database, never in Git. An owner can report payment only after the private 40-second preview and full file exist. Reports do not unlock audio. Staff must verify the entire amount in their bank and explicitly confirm in Admin; confirmation records the request, amount, media version and timestamps. Pending reports freeze price/status changes and media replacement. Invalid or unmatched reports can be rejected. Dashboard notifications include pending transfers. This workflow does not connect to a bank, charge a card, create tax receipts or verify transfers automatically.

## Song artwork

Each order can have a staff-edited song title (up to 120 characters) and cover theme (night, rose, sunrise). Edit under Admin → Orders → Title and cover, then save the order. The owning customer sees the artwork beside the private preview or paid full song. Artwork edits do not unlock audio or change payment state.

## Public example playback

Public example players hide native download controls and direct file links. Customer previews also hide native download controls. The paid owner retains the full song download button. Browser playback can technically be captured; these controls are not DRM.

## Customer account page

/account is a dedicated client account page with Orders/status, Songs/payment, Revisions, Gifts/reviews and Profile sections. Guests sign in before their data is loaded. All order and audio APIs retain ownership checks. The header account button and successful-order link open this page; authentication inside an unfinished order still uses the login dialog to preserve its draft. Tab selection is reflected in the URL hash and supports browser history. Hidden form panels remain mounted to retain in-progress revision and greeting text; audio pauses when leaving the songs section.
