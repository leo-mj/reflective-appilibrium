PID_FILE := backend/.server.pid

# Branding assets are generated, not hand-drawn: the sources are the HTML files
# in app/branding/, rendered with whatever Chrome is installed. Re-run after
# editing either of them. Nothing in CI depends on this — the PNGs are checked
# in, since the deploy has no browser to render them with.
CHROME := /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
SHOT := --headless --disable-gpu --hide-scrollbars
BRANDING := file://$(CURDIR)/app/branding

.PHONY: start stop og-image icons branding

branding: og-image icons

og-image:
	"$(CHROME)" $(SHOT) --window-size=1200,630 \
		--screenshot=app/public/og-image.png app/branding/og-card.html

# Rendered at 512 and downscaled: Chrome will not lay out a window much under
# 500px, so shooting these at their final size crops a larger viewport.
icons:
	"$(CHROME)" $(SHOT) --default-background-color=00000000 \
		--window-size=512,512 --screenshot=/tmp/re-icon-full.png \
		"$(BRANDING)/icon.html?v=full"
	"$(CHROME)" $(SHOT) --default-background-color=00000000 \
		--window-size=512,512 --screenshot=/tmp/re-icon-small.png \
		"$(BRANDING)/icon.html?v=small"
	sips -z 180 180 /tmp/re-icon-full.png --out app/public/apple-touch-icon.png
	sips -z 32 32 /tmp/re-icon-small.png --out app/public/favicon.png

start:
	uvicorn backend.main:app --reload & echo $$! > $(PID_FILE)

stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) && rm $(PID_FILE); \
	else \
		echo "No PID file found — is the server running?"; \
	fi
