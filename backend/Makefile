.PHONY: docs
docs:
    swag init -g cmd/server/main.go
    goplantuml -recursive . > ./docs/architecture.puml