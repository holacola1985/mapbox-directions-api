BROWSERIFY = node_modules/.bin/browserify

all: dist/mapbox.directions.api.js

node_modules/.install: package.json
	npm install && touch node_modules/.install

dist:
	mkdir -p dist

dist/mapbox.directions.api.js: node_modules/.install dist $(shell $(BROWSERIFY) --list index.js)
	npm run build

clean:
	rm -rf dist/mapbox.directions.api.js
