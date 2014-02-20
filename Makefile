
test:
  @NODE_ENV=test mocha -R spec

test-w:
  @NODE_ENV=test mocha --watch

cov:
  @NODE_ENV=test istanbul cover _mocha -- -R spec

.PHONY: test test-w cov

