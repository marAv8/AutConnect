/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  transitionToSessionCompletionConfirmation,
} = require("../clientOrbitCompletion.ts");
const clientOrbitSource = fs.readFileSync(
  require.resolve("../ClientOrbit.tsx"),
  "utf8"
);
const entryFormSource = fs.readFileSync(
  require.resolve("../../portal/notes/add/EntryForm.tsx"),
  "utf8"
);
const specializedFormsSource = fs.readFileSync(
  require.resolve("../../portal/notes/add/EntrySpecializedForms.tsx"),
  "utf8"
);
const carouselSource = fs.readFileSync(
  require.resolve("../ClientCarousel.tsx"),
  "utf8"
);

test("unmounts the action menu before one confirmation click completes once", () => {
  const events = [];
  let menuMounted = true;
  let confirmation = null;
  let completionCalls = 0;

  transitionToSessionCompletionConfirmation(
    "provider-1",
    () => {
      menuMounted = false;
      events.push("menu-unmounted");
    },
    (providerId) => {
      assert.equal(menuMounted, false);
      events.push("confirmation-mounted");
      confirmation = {
        providerId,
        onConfirm: () => {
          completionCalls += 1;
        },
      };
    }
  );

  assert.deepEqual(events, ["menu-unmounted", "confirmation-mounted"]);
  assert.equal(confirmation.providerId, "provider-1");

  confirmation.onConfirm();
  assert.equal(completionCalls, 1);
});

test("caregiver context bypasses provider completion and publishes selections", () => {
  assert.match(
    clientOrbitSource,
    /!isCaregiverProvider\s*&&[\s\S]*?hasOwnInProgressDocumentation/
  );
  assert.match(entryFormSource, /role !== "Caregiver"/);
  assert.match(entryFormSource, /comment: sharedContextCommentRef\.current/);
  assert.match(entryFormSource, /didRestoreCaregiverContextRef/);
  assert.match(specializedFormsSource, /Add note to today's update/);
});

test("caregiver menus keep morning and evening context directly available", () => {
  assert.match(
    clientOrbitSource,
    /showCompletedAuthorPrimary\s*=\s*isMe\s*&&\s*!isCaregiverProvider/
  );
  assert.match(
    clientOrbitSource,
    /showCompletedAuthorUpdate\s*=\s*isMe\s*&&\s*!isCaregiverProvider/
  );
  assert.match(clientOrbitSource, /"Morning Context"/);
  assert.match(clientOrbitSource, /"Evening Context"/);
});

test("individual Entry saves cannot trigger the global publication confirmation", () => {
  const genericSaveHandler = carouselSource.slice(
    carouselSource.indexOf("const markProviderEntrySaved"),
    carouselSource.indexOf("const markProviderSessionCompleted")
  );

  assert.doesNotMatch(genericSaveHandler, /setPublicationConfirmationId/);
  assert.doesNotMatch(genericSaveHandler, /Note published/);
  assert.match(genericSaveHandler, /onEntrySaved\?\./);
});

test("only a successful final completion reaches publication feedback", () => {
  assert.match(
    clientOrbitSource,
    /if \(result\.ok\) \{[\s\S]*?onSessionCompleted\?\./
  );
  assert.match(carouselSource, /claimPublicationAnnouncement/);
  assert.match(carouselSource, /setPublicationConfirmationId/);
  assert.match(carouselSource, />\s*Note published\s*</);
});

test("published and in-progress notepads keep their established actions", () => {
  assert.match(clientOrbitSource, /"Continue today's note"/);
  assert.match(
    clientOrbitSource,
    /"Published — view or update today's note"/
  );
  assert.match(clientOrbitSource, /<Check/);
  assert.match(clientOrbitSource, /Update Note/);
  assert.match(clientOrbitSource, /View Note/);
  assert.match(clientOrbitSource, /Request Case Support/);
});
