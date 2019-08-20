
DEFAULTTESTTIMEOUT=8000

.PHONY: .FORCE

include ./wovtoolscheat.mk
# NOTE: example ./wovtoolscheats.mk is:
#> POSTGRES_PASSWORD=password
#> WOV_wstests_port=3007
#> WOV_DB=wovservice
#> ENVS=WOV_STAGE=cw WOV_ME=cw WOV_PROJECT=wstests \
#>   WOV_testdb_username=postgres WOV_testdb_host=localhost WOV_testdb_database=${WOV_DB} WOV_testdb_password=${POSTGRES_PASSWORD} \
#>   WOV_testdb_port=5432 WOV_testdb_type=postgres WOV_apimatch_port=${WOV_apimatch_port}

all:
	@echo ""
	@echo "See the makefile for more."
	@echo "  : make pg-start    -> launches local db as Docker container"
	@echo "  : make pg-stop     -> stops local db Docker container"
	@echo "  : make mongo-start -> launches local db as Docker container"
	@echo "  : make mongo-stop  -> stops local db Docker container"
	@echo "  : make test        -> run tests"
	@echo "  : make test-html   -> run tests with GUI output"
	@echo "       TEST=test/X ----> add to make test/test-html to select a specific test"
	@echo ""


mongo-start : mongo-docker-start

mongo-docker-start:
	@docker run --rm --name mongo-local -d \
		-p 27017:27017 \
		mongo:3.6-xenial

#		-e MONGO_INITDB_ROOT_USERNAME=${WOV_testdb_username} \
#		-e MONGO_INITDB_ROOT_PASSWORD=${WOV_testdb_password} \

mongo-stop:
	@docker stop mongo-local

pg-start : pg-docker-start pg-docker-start-delay pg-create-db

pg-docker-start :
	@docker run --rm --name postgres-local -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} -d -p 5432:5432 postgres:9.6

pg-docker-start-delay :
	@sleep 5

pg-create-db :
	@PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -c "create database ${WOV_DB}"

pg-stop :
	@docker stop postgres-local

pg :
	PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -d "${WOV_DB}" || printf '\nERROR: run "make pg-start" to start postgres (and make pg-db to populate it)\n\n'

test : .FORCE
	${ENVS} mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT}

test-html : .FORCE
	${ENVS} WOV_TEST=$$TEST mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT} --reporter mochawesome --reporter-options reportDir=.mochawesome-report ; open -g ./.mochawesome-report/mochawesome.html

