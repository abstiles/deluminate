.PHONY: clean package

MANIFEST := background.js common.js deluminate-*.png deluminate.css \
	deluminate.js manifest.json popup.html popup.js

package: deluminate.zip
deluminate.zip: $(MANIFEST)
	zip deluminate $(MANIFEST)

clean:
	rm deluminate.zip
