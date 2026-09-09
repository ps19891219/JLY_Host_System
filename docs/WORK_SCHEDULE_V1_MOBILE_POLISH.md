# Work Schedule V1 mobile polish

First production handset test showed the create/edit dialog inherited global button sizing. The close button stretched across the header and forced the title into a narrow column.

Fix contract:
- dialog header title keeps normal width
- close control is a compact 44x44 touch target
- dialog is centered with bounded height and internal scrolling
- iPhone safe-area padding is respected
- form fields never overflow the dialog width
- mobile layout stays single-column where useful
