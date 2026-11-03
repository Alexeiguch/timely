# TestFlight metadata — 2026-10-12

App: Timely · App Store Connect `6821749473` · bundle `com.example.timely.dev`.

The owner authorized the native TestFlight update, icon, description and screenshots. Build **0.1.0 (2)** is uploaded, processed and **Validated** by Apple, with access assigned to the existing **Internal** group (two testers). Build ID: `b74b1508-1e7e-41a4-ae58-7b29889a356e`. [Build details](https://appstoreconnect.apple.com/teams/a28c13e4-e219-4fdb-bf39-5ffa7d2acc6b/apps/6821749473/testflight/ios/b74b1508-1e7e-41a4-ae58-7b29889a356e).

The existing opaque 1024 × 1024 Timely brand icon is embedded in the uploaded asset catalog. Archive signature, marketing icon, version, bundle identity, non-exempt encryption flag and production API URL were verified. The native build uses `2f9f9f4` (application changes in `3103e52`) with the owner's store configuration; the development native project was preserved. No App Store review submission or external tester group was created.

## Beta description: Spanish (Mexico)

Timely es tu agenda personal para organizar el día y crear hábitos a tu ritmo.

Planifica tareas en las vistas Día, Semana y Mes. Añade horarios, duración, prioridades y repeticiones; completa o mueve una tarea cuando cambien tus planes. Activa rachas en las tareas recurrentes y revisa tu progreso y tu historial.

Tus cambios se guardan en el dispositivo incluso sin conexión y se sincronizan con tu cuenta al volver a conectarte. La app está disponible en español e inglés.

Durante esta beta, prueba la planificación, las repeticiones, las rachas, la búsqueda y la sincronización entre dispositivos. Comparte tus comentarios desde TestFlight.

## Beta description: English (US)

Timely is your personal planner for organizing your day and building habits at your own pace.

Plan tasks in Day, Week and Month views. Add times, durations, priorities and repeat schedules, then complete or move tasks as your plans change. Enable streaks for recurring tasks and review your progress and history.

Your edits are saved on your device even when you are offline and sync with your account when you reconnect. Timely is available in Spanish and English.

During this beta, try planning, recurring tasks, streaks, search and synchronization across devices. Share feedback through TestFlight.

Both descriptions were saved in App Store Connect. The existing feedback/review/contact fields were preserved.

## Screenshot placement

Apple's TestFlight invitation experience uses screenshots from the latest **Ready for Distribution** App Store version. This app currently has a **Prepare for Submission** draft (1.0). Screenshots can be uploaded to that draft, but will not become TestFlight invitation screenshots before an App Store version is approved. No public App Store submission is authorized by this update.

Five actual native screenshots are saved in the Spanish (Mexico) draft listing: iPhone Day, Month and completed-task Review; iPad Day and Month. Apple accepted their original resolutions, **1206 × 2622** and **2064 × 2752**. Native JPEG capture avoids alpha channels. The screenshots were checked after navigating away and returning to the draft; the listing shows three iPhone and two iPad screenshots. Files and SHA-256 hashes are in [the screenshot manifest](app-store/screenshots/manifest.json).

The latest simulator Release binary signed into a newly created synthetic account through real hosted email OTP authentication and synchronized all seven authored tasks, including one completion. No mocked authentication or persistence was used. After capture, only that exact synthetic account and its cascading test data were removed; temporary authentication material was deleted. Both disposable listing simulators were shut down. These checks do not establish physical-device provider/reminder acceptance.

## Build testing notes

Saved in Spanish (Mexico) and English (US) for build 2. They ask testers to check task creation, editing, completion and moves; recurrence and streaks; history search; retained offline edits and reconnection; consistent overdue lists across web/native; and synchronization recovery after connection failure.

## Artifacts and continuation

- Local archive/export: `/tmp/timely-testflight-20261012/Timely.xcarchive`, `/tmp/timely-testflight-20261012/ipa/Timely.ipa`.
- Durable ignored IPA/manifest: `.local/releases/2026-10-12/testflight-build-2/`.
- Build, simulator and upload logs: `/tmp/timely-testflight-20261012/{build,simulator-build,upload}.log`; all commands exited 0.
- UI proof: `.local/testflight-20261012/{build-2-internal,beta-description-saved,iphone-screenshots-saved,ipad-screenshots-saved}.png`.
- `pnpm --filter @timely/mobile typecheck` and `git diff --check` pass.
- EAS iOS production build counter initialized to **2**; the next auto-incremented build should be **3**. Local Xcode builds must explicitly set `IOS_BUILD_NUMBER=3` or a later unused number.
- A public App Store release is a separate owner-authorized action. The current draft is 1.0, while beta builds are 0.1.0. Before submitting, choose the public version, complete required privacy/support/review fields and native acceptance, and upload a matching build.

References: [beta test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/), [app icons](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).


## Usability build 3 — 2026-10-13

Apple accepted **0.1.0 (3)** from `8151368b02a725f7d8956d1e3f72beb14187ce75` and reported the package processing. Processing completion, Internal tester access and build-specific testing notes have not been verified; the browser session is signed out and Expo has no App Store Connect API key. Build 2 remains the last independently verified Internal build. The owner refreshed Xcode authentication and upload then succeeded. No public review submission occurred.

Archive: `/tmp/timely-testflight-20261013/Timely.xcarchive`; durable IPA/manifest: `.local/releases/2026-10-13/testflight-build-3/`. SHA-256: `559bb7cd42c5206c92f8939c11b4e4e66c48f7d571f861dc123710645e018ce4`. Signature, production entitlement/API, embedded bundle, identity and encryption flag pass. Nonfatal missing vendor-framework dSYM warnings remain. EAS production counter is **3**; the next unused build is **4**. [Full release evidence](progress.md#authorized-usability-deployment--2026-10-13).

### Prepared testing notes (not saved to Apple)

English: Try the simpler task editor, repeat options, Search filters and reminder settings. Check that unfinished work and date ranges are clear. Save an edit offline and reconnect. Daily summaries are opt-in on this installation; check local delivery and cancellation on a physical device. Hosted remote notifications remain disabled.

Spanish: Prueba el editor de tareas más sencillo, las opciones de repetición, los filtros de búsqueda y los ajustes de recordatorios. Comprueba que las tareas pendientes y los intervalos de fechas se entiendan. Guarda un cambio sin conexión y vuelve a conectarte. El resumen diario es opcional en esta instalación; comprueba la entrega local y la cancelación en un dispositivo físico. Las notificaciones remotas siguen desactivadas.


## Larger login logo build 4 — 2026-10-13

Apple accepted **0.1.0 (4)** from `cd86f9c48f33b5f3048dd81bd88322727fa392bb`; Xcode reported `Upload succeeded` and `EXPORT SUCCEEDED`. The login brand is now 56px, with wrapping for narrow layouts. Processing completion/Internal assignment remain unverified. Build 2 is still the last independently verified Internal build; no public review submission occurred.

Archive/export/logs: `/tmp/timely-login-logo-ios-20261013/`; durable IPA/manifest: `.local/releases/2026-10-13/testflight-build-4/`. SHA-256: `49f40cc4d6c1a820b67954739dd7791ece940ead267fb5cbcd787310ae7f9e10`. Signature, identity, production entitlement/API and embedded bundle checks pass. Vendor-framework symbol warnings are nonfatal. EAS production counter is **4**; next unused build is **5**. Browser control was stopped before further Apple UI verification.


## Finite streak build 5 — 2026-10-13

Apple accepted **0.1.0 (5)** from `7c0832e5d5085ee6756ccc8b8899493f1450f2c7`, with the larger login brand and three-cycle streak feedback. Xcode reported processing, `Upload succeeded` and `EXPORT SUCCEEDED`. Selected native/shared inputs, signature, identity, production entitlement/API, version and embedded bundle were verified. Processing completion/Internal tester access remain unverified; no public review submission occurred.

Archive/export/logs: `/tmp/timely-streak-ios-20261013/`. Durable IPA/manifest/handoff: `.local/releases/2026-10-13/testflight-build-5/`. SHA-256: `ad50d00b38ad54d0549c3f6c3c9cbe7e026a3dc53e5e3124ae7e408378fa6324`. Vendor-framework dSYM warnings remain nonfatal. EAS production counter is **5**; next unused number **6**. Confirm the build's existing Internal group access in App Store Connect, then verify three pulses/resting state, foregrounding and reduced motion on a physical device. The browser session still requires sign-in; Expo has no App Store Connect API key.


## Account recovery and public help build 6 — 2026-11-03

Source `95b7f0c890f4b3bad8ed01a5533c21c5506f6bcf`; bundle `com.example.timely.dev`; version **0.1.0 (6)**. Archive/export and deep/strict IPA signature validation pass. Apple accepted the upload at 14:25:49 UTC (`Upload succeeded`, `EXPORT SUCCEEDED`), and App Store Connect visibly lists build 6 Processing. Durable IPA/manifest/handoff: `.local/releases/2026-11-03/testflight-build-6/`; exported IPA SHA-256 `4008e9b937a76e1d4a784bbe7a6a1a787f2ca7b3f6bf69b3b004c5a988a2a459`. EAS iOS counter is 6; next unused build number is 7. Processing is complete. Both testing-note locales below are saved, and build 6 is assigned to the existing **Internal** group (two testers). The group’s Builds page visibly shows **0.1.0 (6), En pruebas**, with 90 days remaining. Apple build ID: `bcea9bcf-761b-4c53-a260-bd33eff391ae`. [Verified Internal builds](https://appstoreconnect.apple.com/teams/a28c13e4-e219-4fdb-bf39-5ffa7d2acc6b/apps/6821749473/testflight/groups/0e87cb87-b313-4792-a25e-ead0910b8f0e/builds). No public App Store review occurred.

App Store Connect confirms builds 3–5 are processed but have no Internal group assignment. The Internal group now has builds **6, 2 and 1**, preserving its existing testers and earlier builds. Physical install/use of build 6 remains separate from this verified distribution status.

### Testing notes: English (US)

Try Settings → Manage account → Sign in again and confirm your saved plans remain. Open the privacy, support and account deletion links from sign-in and Settings. The privacy policy is still a draft while contact and retention details are confirmed. Check task creation/editing, recurring plans, offline save/reconnect, search and history. On a physical device, check optional reminders and daily-summary delivery/cancellation. Use a disposable test account if testing permanent account deletion.

### Testing notes: Spanish (Mexico)

Prueba Ajustes → Gestionar cuenta → Volver a iniciar sesión y comprueba que tus planes guardados se conservan. Abre los enlaces de privacidad, ayuda y eliminación de cuenta desde el inicio de sesión y Ajustes. La política de privacidad sigue siendo un borrador mientras se confirman el contacto y los plazos de conservación. Comprueba la creación y edición de tareas, las repeticiones, el guardado sin conexión y la sincronización al reconectar, la búsqueda y el historial. En un dispositivo físico, comprueba la entrega y cancelación de recordatorios y del resumen diario opcional. Usa una cuenta de prueba desechable para comprobar la eliminación permanente de cuenta.


## Simpler sign-in and native Apple — build 7 preparation (2026-11-03)

Status: Apple accepted the owner-authorized upload at **21:00:39 UTC** on 2026-11-03. Build **`aab8c9d3-5c63-481c-9b70-ae048a91a475`**, **0.1.0 (7)**, is processed and **En pruebas** in the existing Internal group for **two testers**, verified at 21:13 UTC. Its earlier builds 6, 2 and 1 remain available. See [verification/handoff](mobile-sign-in-2026-11-03.md). Source `3143482` is deployed with the native-only Apple configuration and registered `APPLE_BUNDLE_ID=com.example.timely.dev`; live capabilities verify `appleNative=true`. Preserve version 0.1.0, bundle `com.example.timely.dev`, existing Internal group and both testers. EAS's production iOS counter is verified as **7**; next unused build is **8**. Do not reupload this build. The two testing-note locales below were entered but saving redirected to Apple sign-in; **saving is unverified**, pending owner session renewal. No public review was submitted.

English (US), What to Test:

A simpler sign-in screen with clear email-code entry and Apple sign-in. Try signing in with Apple for the first time and again, Hide My Email, cancellation and email-code fallback. Complete a task: progress should update without a banner. Open completed tasks to reopen it, then restart the app and check that your session and plans remain. Check Spanish and English, larger text and iPad layout.

Spanish (Mexico), Qué probar:

Inicio de sesión más sencillo, con un campo claro para el código del correo y acceso con Apple. Prueba el primer acceso con Apple, volver a entrar, Ocultar mi correo, cancelar y acceder con un código de correo. Completa una tarea: el progreso debe actualizarse sin avisos. Abre las tareas completadas para volver a activar una, reinicia la app y comprueba que se conservan la sesión y tus planes. Revisa español e inglés, texto grande y la pantalla del iPad.
