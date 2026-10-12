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

## Восстановление пароля

Кнопка «Забыли пароль?» во входе и ссылка в профиле ведут на /forgot-password. Настройте исходящую почту один раз от root в SSH: `bash /srv/ssoundcheck/current/scripts/beget/setup-mail.sh`. Нужен существующий почтовый ящик с SMTP; для Beget используются smtp.beget.com и 465 (SSL). Скрипт скрыто запрашивает пароль, проверяет соединение и отправляет проверочное письмо перед сохранением настроек в /etc/ssoundcheck.env (0600), затем перезапускает сервис. Секрет не попадает в Git или аргументы процесса. Порт 587 требует STARTTLS. Не отключайте проверку сертификата. Если почты нет, её нужно создать у почтового провайдера и настроить DNS домена по его инструкции.

Также сохранена поддержка RESEND_API_KEY + AUTH_FROM_EMAIL для верифицированного домена Resend; SMTP имеет приоритет. Без настройки почты страница честно сообщает о недоступности восстановления. Ссылка одноразовая, срок 30 минут; сброс завершает все старые сеансы, не удаляет заявки. Запросы ограничены (3 за 5 минут по IP); ответ не раскрывает существование email. Ошибки доставки записываются без адреса, ссылки и секретов в журнал сервиса. Получение письма реальным клиентом нужно проверить после настройки почты.

## Уведомления о готовности фрагмента

После загрузки MP3 (сервер переводит заказ в ready) или перехода в ready при уже существующих файлах сайт ставит письмо в SQLite-очередь в одной транзакции с изменением заказа. Получатель — email аккаунта владельца, а не контакт из заявки. Письмо содержит название, короткий номер и ссылку /account#music; аудио и ссылки на частные файлы не прикладываются. До подтверждения оплаты остаются прежние ограничения доступа. Для уже оплаченного заказа письмо сообщает о доступности полной песни.

Исходящая почта использует ту же настройку SMTP/Resend, что восстановление пароля. Каждая версия песни уведомляется отдельно; повторное сохранение и смена статуса той же версии не создают дубликат. Старые заказы не рассылаются автоматически при миграции. Заказы без реального email, отменённые заказы и заменённые версии пропускаются. В панели под плеером показан статус, при окончательной ошибке доступен повторный запуск. «Отправлено» означает принятие почтовым сервером, а не прочтение получателем.

Работник запускается через instrumentation в Node-сервисе и проверяет очередь каждые 30 секунд, в том числе без открытой панели. Очередь переживает рестарт. До пяти попыток с задержками 1, 5, 15 и 60 минут; срок захвата задания 2 минуты. SMTP имеет стабильный Message-ID, Resend — ключ идемпотентности. Редкий сбой между принятием письма SMTP и сохранением результата может привести к повторной доставке: SMTP не даёт транзакционной гарантии ровно одного письма. Ошибка почты не откатывает сохранённую песню. Закрытые данные и секреты не записываются в журнал ошибок.

Проверки уведомлений после сборки: `node scripts/order-ready-email-integration.mjs` (локальный TLS SMTP, временная SQLite и MP3) и `node scripts/password-reset-integration.mjs`. Они не отправляют письма реальным получателям. Общая проверка заявок и доступа: `node scripts/admin-integration.mjs`.

## Переписка внутри заказа

В кабинете есть вкладка «Переписка», в панели — чат каждой заявки. Клиент и студия могут задавать вопросы и обсуждать правки до и после готовности песни. Сообщения сохраняются в SQLite, при открытом видимом чате обновляются каждые 15 секунд. Непрочитанные ответы отображаются у заявки и в кабинете; новые сообщения клиента входят в уведомления панели. Чат не рассылает сообщения по email. Почта используется отдельно для входа, восстановления и уведомлений о готовности фрагмента.

Клиент видит только свои заказы, студия — через защищённую панель. Роль автора назначает сервер, текст выводится без HTML. UUID отправки предотвращает дубли при повторе запроса; максимум 2000 символов, до 10 сообщений за минуту в заказе и до 60 за час на клиента. Последние 100 сообщений загружаются первыми, остальная история — кнопкой. Прочтение отмечается отдельно для клиента и студии, по последовательности сообщения, без изменения статуса заказа или доступа к аудио.

В форме заявки можно выбрать «Общаться внутри сайта» или указать @username в Telegram. Для распознанного имени или ссылки https://t.me/username в панели появляется кнопка Telegram. Сообщения в Telegram отправляются вручную; бот и автоматическая пересылка не подключаются. Поле короткой заметки о статусе сохранено отдельно от истории переписки.

Проверка переписки после сборки: `node scripts/order-conversation-integration.mjs`. Использует отдельную базу и standalone-сервер, проверяет права, роли, историю, прочтение, повторные запросы и ограничения отправки.

### Local traffic analytics

Admin → Посещения shows homepage visits only. Next proxy counts HTML GET documents (not RSC, prefetch, API, account, gift or admin); authenticated staff visits are excluded. Signed HttpOnly SameSite cookies group a visit after 30 minutes inactivity and recognize a random browser ID for 30 days. SQLite stores SHA-256 random browser IDs, source categories and coarse device type, not IP, UA, query strings, referrer URLs or form values. Browser visibility ≥2 seconds plus trusted input is labelled *probably human*, never guaranteed. Known bot User-Agents are request counts; webdriver browser signals mark automation. Ordinary reading without input remains uncertain. Blocking JS/cookies, switching devices, spoofed UA/signals and multiple tabs affect accuracy. Records retained up to 90 days with lazy hourly cleanup; reporting days use Europe/Moscow (UTC+3), visits/views grouped by visit start. Source categories recognize utm_source=telegram/tg/vk/yandex/google/bing and known referrer hosts. Initial statistics start after deployment; no log backfill. Analytics failures fail open and do not prevent site use. Test: node scripts/traffic-integration.mjs.

Admin traffic also shows current auth_user account count, new accounts for the selected period and today (Moscow). Counts include accounts created before analytics; deleted accounts are not retained in the total. Homepage service selection opens signup/login before the order form for guests; successful authentication resumes the chosen service/draft, cancellation does not open the form. Server customerGuard remains required on all order submissions.
