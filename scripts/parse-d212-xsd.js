#!/usr/bin/env node
/**
 * Parse ANAF D212 XSD into a normalized JSON listing of every named
 * element + its attributes (name, type, use, documentation, BT code).
 *
 * Strategy: walk the XSD line by line and maintain a stack of currently-open
 * named xs:element scopes. Each xs:attribute encountered is attached to the
 * innermost open named element.
 */

const fs = require('fs');
const path = require('path');

// Default to the in-repo copy under docs/anaf/d212-2025/. Override with an
// explicit path argument when running against a newer ANAF release that hasn't
// been added to the repo yet, e.g.:
//   node scripts/parse-d212-xsd.js ~/Downloads/d212-2026/D212.xsd
const DEFAULT_XSD = path.join(__dirname, '..', 'docs', 'anaf', 'd212-2025', 'D212.xsd');
const XSD_PATH = process.argv[2] || DEFAULT_XSD;
const xml = fs.readFileSync(XSD_PATH, 'utf8');
const lines = xml.split('\n');

const sections = []; // { name, doc, attributes: [...] }
const sectionsByName = new Map();
const scopeStack = []; // names of currently-open elements

let pendingAttr = null;

function captureDoc(text) {
  const m = text.match(/\(([A-Z]+-\d{5})\)\s*$/);
  return {
    text: text.replace(/\(([A-Z]+-\d{5})\)\s*$/, '').trim(),
    bt: m ? m[1] : null
  };
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // <xs:element name="X" (not self-closing) -> push new scope
  const elOpen = line.match(/<xs:element[^>]*\bname="([^"]+)"/);
  if (elOpen) {
    const name = elOpen[1];
    if (!line.includes('/>')) {
      scopeStack.push(name);
      if (!sectionsByName.has(name)) {
        const sec = { name, doc: '', attributes: [] };
        sections.push(sec);
        sectionsByName.set(name, sec);
      }
    }
  }
  // self-closing <xs:element ... />
  // (we don't track those — they don't open a scope)

  // closing </xs:element>
  if (line.includes('</xs:element>')) {
    scopeStack.pop();
  }

  // <xs:attribute name="X" type="Y" use="Z">
  const attrMatch = line.match(/<xs:attribute[^>]*\bname="([^"]+)"[^>]*\btype="([^"]+)"[^>]*\buse="([^"]+)"/);
  if (attrMatch) {
    pendingAttr = { name: attrMatch[1], type: attrMatch[2], use: attrMatch[3], doc: '', bt: null };
    const owner = scopeStack[scopeStack.length - 1];
    const sec = owner ? sectionsByName.get(owner) : null;
    if (sec) sec.attributes.push(pendingAttr);
  }
  if (line.includes('</xs:attribute>') || (line.match(/<xs:attribute[^>]*\/>/))) {
    // close pending
    pendingAttr = null;
  }

  // <xs:documentation>...</xs:documentation>
  const docMatch = line.match(/<xs:documentation>([\s\S]*?)<\/xs:documentation>/);
  if (docMatch) {
    const captured = captureDoc(docMatch[1]);
    if (pendingAttr) {
      pendingAttr.doc = captured.text;
      pendingAttr.bt = captured.bt;
    } else {
      // documentation right after element open — belongs to the current scope
      const owner = scopeStack[scopeStack.length - 1];
      const sec = owner ? sectionsByName.get(owner) : null;
      if (sec && !sec.doc) sec.doc = captured.text;
    }
  }
}

// Output: list of sections (top-level chapter elements), each with their attributes
// Filter out trivial simpleType/complexType wrappers that ended up as scopes
const interesting = sections.filter(s => s.attributes.length > 0);

console.log(JSON.stringify(interesting, null, 2));

