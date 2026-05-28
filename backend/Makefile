.PHONY: help test test-all test-unit test-integration test-api test-iam test-resources test-scheduling test-coverage test-failed lint format clean install-test-deps

YELLOW := \033[0;33m
GREEN := \033[0;32m
NC := \033[0m

PYTHON ?= ./.venv/bin/python
PYTEST := PYTHONPATH=src CRAGS_TEST_DATABASE_URL=$${CRAGS_TEST_DATABASE_URL:-postgresql+psycopg://crags:crags@127.0.0.1:5433/crags} $(PYTHON) -m pytest

help: ## Display this help screen
	@echo "$(YELLOW)CRAGS Backend Test Commands$(NC)"
	@echo "$(YELLOW)===========================$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-24s$(NC) %s\n", $$1, $$2}'

test: ## Run the full backend suite
	@$(PYTEST)

test-all: test ## Alias for the full backend suite

test-unit: ## Run only unit-marked tests
	@$(PYTEST) -m unit

test-integration: ## Run only integration-marked tests
	@$(PYTEST) -m integration

test-api: ## Run API smoke coverage
	@$(PYTEST) tests/test_api.py

test-iam: ## Run IAM coverage
	@$(PYTEST) tests/test_iam.py

test-resources: ## Run resources coverage
	@$(PYTEST) tests/test_resources.py

test-scheduling: ## Run scheduling coverage
	@$(PYTEST) tests/test_scheduling.py

test-coverage: ## Run the suite with coverage
	@$(PYTEST) --cov=crags --cov-report=html --cov-report=term-missing
	@echo "$(GREEN)Coverage report generated in htmlcov/index.html$(NC)"

test-failed: ## Re-run only previously failed tests
	@$(PYTEST) --lf

lint: ## Check code style with ruff
	@ruff check .

format: ## Format source and test files
	@black src/ tests/
	@ruff check --fix .

clean: ## Remove local test and coverage artifacts
	@rm -rf .pytest_cache __pycache__ htmlcov .coverage .coverage.* *.egg-info
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete

install-test-deps: ## Sync backend dev dependencies with uv
	@uv sync --group dev

.DEFAULT_GOAL := help
