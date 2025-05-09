.PHONY: run-docker
run-docker:
	@docker compose up --build --force-recreate --remove-orphans

.PHONY: stop-docker
stop-docker:
	@docker compose down 

.PHONY: reload-docker
reload-docker:
	@make stop-docker
	@make run-docker

.PHONY: purge
purge:
	@docker compose down
	@docker compose rm -f
	@docker container prune
	@docker image prune -a