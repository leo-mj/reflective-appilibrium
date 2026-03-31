PID_FILE := backend/.server.pid

start:
	uvicorn backend.main:app --reload & echo $$! > $(PID_FILE)

stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) && rm $(PID_FILE); \
	else \
		echo "No PID file found — is the server running?"; \
	fi
