## New

### ~~Invoice line item amounts calculated incorrectly~~ ✅
- entering quantity on a custom invoice line item:
  - ~~displays number on pdf, but does not multiply line by amount for line total~~
  - ~~does not display number on invoice sheet view~~

### ~~Rate not displaying correctly on PDF~~ ✅
- ~~Invoice JM188 has an entry billed at Photographer rate (60), but it still says 45 on the pdf invoice (despite calculating the total correctly)~~




## Functional

- [ ] Settings > Invoicing > Include super in totals
  - Toggle
  - If off, total without super is shown as "total" in tables.
  - Also, add subtotal to invoice sheet (subtotal, super, total)
- [ ] Swipe to delete gestures. Research. Is this built into shadcn?
  - Recommendation: framer-motion if you want the polished iOS-style "swipeleft to reveal delete button" pattern with proper spring physics.
    @use-gesture/react + CSS if you want minimal bundle impact and are
    comfortable building the animation manually.
  - Worth noting: this app currently uses sheets (modals) for delete
    confirmation — swipe-to-delete would be a different interaction model,
    best suited to the list rows in entries and expenses views.
- [ ] Build out login screen with logo etc
- [ ] Enable/Disable clients
- [ ] Add log out button to settings > account (sidebar not accessible on mobile)
- [ ] Client view (mobile): copy search and filter toggle from invoice view
- [ ] Clicking email link from dashboard should open that sheet
- [ ] Entries view: link invoice chip to invoices view + auto-open the matching invoice sheet (`?view=invoices&invoice=<id>`; requires adding `invoiceId` to `ClientWeekGroup` and a URL-param handler in `InvoicesClient`)
- [ ] Client view: Add button to add client
- [ ] Dashboard: 6-month earnings chart
  - [x] Remove current month chart (previous 6-months)
  - [ ] Create dropdown to change comparison range (data should already be loaded into the dom, I believe so should be instant)

## Visual

- [ ] Search bars and header items should not be skeletons, they should load as full assets immediately, while table elements show skeletons that then load in
- [ ] Invoices skeleton needs to have enough entries to extend beyond the bottom of the viewport
- [ ] Settings view skeleton has big shift once content loads

## Bugs

- [ ] If invoice email fails all Inngest retries, `onFailure` reverts `issued_date` to null and status to draft — but if the invoice was already manually set to `issued` before the email, the revert incorrectly clears it. Fix: compare `issued_date` against the scheduled send date before reverting.
- [ ] Error with Permissions-Policy header: Unrecognized feature: 'browsing-topics'.
- [ ] Bug: Editing entry line item on mobile opens client select interface briefly first
