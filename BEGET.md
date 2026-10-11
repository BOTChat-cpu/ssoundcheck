# SSoundCheck on Beget

Independent Node.js/Next.js application. Registration and reviews use local SQLite.

Upload this source archive to the VPS, extract it, then run `bash scripts/beget/install.sh` as root. The installer builds as the unprivileged ssoundcheck user and configures Nginx and a systemd service. The database remains in /srv/ssoundcheck/data/site.sqlite; secrets remain in /etc/ssoundcheck.env and are never included in this archive.

Staging URL: http://141.133.201.46. This is a test address; add HTTPS and update BETTER_AUTH_URL before public launch. Keep the existing domain pointed at its current host until staging has passed. Automated deployment is not configured yet.

Validation: production build and TypeScript pass; migration is repeatable; homepage/assets, signup, signin, session, signout, review persistence, duplicate prevention, and origin validation pass against the standalone server. Browser visual QA and remote deployment have not been performed.

At the pre-migration database check on 11 October 2026, deployed auth_user, auth_account, and reviews tables were empty. Recheck before final cutover.
