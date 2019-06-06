
DEFAULTTESTTIMEOUT=8000

.PHONY: .FORCE

include ./wovtoolscheat.mk
# NOTE: example ./wovtoolscheats.mk is:
#> POSTGRES_PASSWORD=password
#> WOV_wstests_port=3007
#> WOV_DB=wovservice
#> ENVS=WOV_STAGE=cw WOV_ME=cw WOV_PROJECT=wstests \
#>   WOV_apidb_username=postgres WOV_apidb_host=localhost WOV_apidb_database=${WOV_DB} WOV_apidb_password=${POSTGRES_PASSWORD} \
#>   WOV_apidb_port=5432 WOV_apidb_type=postgres WOV_apimatch_port=${WOV_apimatch_port}

all:


pg-start :
	docker run --rm --name postgres-local -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} -d -p 5432:5432 postgres
	sleep 5
	@PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -c "create database ${WOV_DB}"

pg-stop :
	docker stop postgres-local

pg :
	PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U postgres -d "${WOV_DB}" || printf '\nERROR: run "make pg-start" to start postgres (and make pg-db to populate it)\n\n'

test : .FORCE
	if [ -e "dist" ]; then \
		cd dist ; ${ENVS} mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT}; \
		else \
		${ENVS} mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT}; \
  fi
