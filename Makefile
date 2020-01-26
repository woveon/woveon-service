
DEFAULTTESTTIMEOUT=8000

.PHONY: .FORCE


POSTGRES_PASSWORD=aVUN4NqxXSmdZS7niy0n
POSTGRES_PORT=54322
MONGO_PORT=54323
WOV_wstests_port=3007
WOV_DB=wovservice

ENVS=WOV_STAGE=cw WOV_ME=cw WOV_PROJECT=wstests \
    WOV_testdb_username=postgres \
    WOV_testdb_endpoint=localhost \
    WOV_testdb_database=${WOV_DB} \
    WOV_testdb_password=${POSTGRES_PASSWORD} \
    WOV_testdb_port=${POSTGRES_PORT} \
    WOV_testdb_type=postgres

#include ./wovtoolscheat.mk
# NOTE: example ./wovtoolscheats.mk is:
#> POSTGRES_PASSWORD=password
#> WOV_wstests_port=3007
#> WOV_DB=wovservice
#> ENVS=WOV_STAGE=cw WOV_ME=cw WOV_PROJECT=wstests \
#>   WOV_testdb_username=postgres WOV_testdb_host=localhost WOV_testdb_database=${WOV_DB} WOV_testdb_password=${POSTGRES_PASSWORD} \
#>   WOV_testdb_port=5432 WOV_testdb_type=postgres WOV_apimatch_port=${WOV_apimatch_port}

DOCKEREXT="ws"

all:
	@echo ""
	@echo "See the makefile for more."
	@echo "  : make pg-start    -> launches local db as Docker container"
	@echo "    : make pg-create-db  -> creates the db needed for testing in a running postgres db"
	@echo "  : make pg-stop     -> stops local db Docker container"
	@echo "  : make pg-psql     -> psql command line in db"
	@echo "  : make mongo-start -> launches local db as Docker container"
	@echo "  : make mongo-stop  -> stops local db Docker container"
	@echo "  : make test        -> run tests"
	@echo "  : make test-html   -> run tests with GUI output"
	@echo "       TEST=X ----> add to make test/test-html to select a specific test"
	@echo "       ex. make test-html TEST=test110"
	@echo ""
	@echo "  postgres-${DOCKEREXT} status: ${shell docker ps -a -f name=postgres-${DOCKEREXT} --format "{{.Status}}"}"
	@echo "     mongo-${DOCKEREXT} status: ${shell docker ps -a -f name=mongo-${DOCKEREXT} --format "{{.Status}}"}"
	@echo ""


mongo-start : mongo-docker-start

mongo-docker-start:
	@docker run --rm --name mongo-${DOCKEREXT} -d \
		-p ${MONGO_PORT}:27017 \
		mongo:3.6-xenial

#		-e MONGO_INITDB_ROOT_USERNAME=${WOV_testdb_username} \
#		-e MONGO_INITDB_ROOT_PASSWORD=${WOV_testdb_password} \

mongo-stop:
	@docker stop mongo-${DOCKEREXT}

pg-start : pg-docker-start pg-docker-start-delay pg-create-db

pg-docker-start :
	@echo "$@"
	@docker run --rm --name postgres-${DOCKEREXT} -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} -d -p ${POSTGRES_PORT}:5432 postgres:9.6

pg-docker-start-delay :
	@echo "$@"
	@sleep 5

pg-create-db :
	@echo "$@"
	@PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -p "${POSTGRES_PORT}" -c "create database ${WOV_DB}"

pg-psql :
	PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -p "${POSTGRES_PORT}" -d ${WOV_DB}

pg-stop :
	@docker stop postgres-${DOCKEREXT}

pg :
	PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -p "${POSTGRES_PORT}" -d "${WOV_DB}" || printf '\nERROR: run "make pg-start" to start postgres (and make pg-db to populate it)\n\n'

test : .FORCE
	$(eval TESTFILE := $(shell ls test/${TEST}*.js) )
	@if [ "${TEST}" != "" ] && [ "${TESTFILE}" == "" ]; then printf "\n***ERROR: Test '${TEST}' not found\n----- TESTS\n"; ls test; exit 1; fi
	${ENVS} mocha -b ${TESTFILE} --timeout ${DEFAULTTESTTIMEOUT}
#	${ENVS} mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT}

test-html : .FORCE
	$(eval TESTFILE := $(shell ls test/${TEST}*.js) )
	@if [ "${TEST}" != "" ] && [ "${TESTFILE}" == "" ]; then printf "\n***ERROR: Test '${TEST}' not found\n----- TESTS\n"; ls test; exit 1; fi
	${ENVS} WOV_TEST=${TEST} mocha -b ${TESTFILE} --timeout ${DEFAULTTESTTIMEOUT} --reporter mochawesome --reporter-options reportDir=.mochawesome-report ; open -g ./.mochawesome-report/mochawesome.html
#	${ENVS} WOV_TEST=$$TEST mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT} --reporter mochawesome --reporter-options reportDir=.mochawesome-report ; open -g ./.mochawesome-report/mochawesome.html

