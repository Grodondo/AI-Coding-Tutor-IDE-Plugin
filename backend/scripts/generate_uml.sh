#!/bin/bash

# Generate PlantUML file
go-plantuml generate ./internal/... > ./docs/architecture.puml

# If you want to convert to PNG (requires plantuml.jar)
# plantuml ./docs/architecture.puml