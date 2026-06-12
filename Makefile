.PHONY: setup test test-web test-cli test-swift audit build check

setup:
	cd web && npm ci
	cd web/cli && npm ci

test: test-web test-cli test-swift

test-web:
	cd web && npm run check
	cd web && npm test

build:
	cd web && npm run build

test-cli:
	cd web/cli && npm test

test-swift:
	cd MarkdownNotes && swift test

audit:
	cd web && npm audit
	cd web/cli && npm audit

check: audit test build
