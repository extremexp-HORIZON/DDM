
cd ..
ddm_path_node_1=$(pwd)

ddm_path_node_2=$(ssh karagk@146.124.106.171 "cd ./volume; cd DDM; pwd")

export PV_ZENOH_1=$ddm_path_node_1/zenoh1
export PV_ZENOH_4=$ddm_path_node_2/zenoh4
export NODE_NAME_1=zorro-solutions
export NODE_NAME_2=extremexp-171

export DDM_BACKEND_IMAGE=karageorge/ddm-backend:1.86
export DDM_CELERY_IMAGE=geopap87/ddm-celery:1.0
export DDM_FRONTEND_IMAGE=karageorge/ddm-frontend:1.87

NODE2_IP=$(kubectl get node $NODE_NAME_1 -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')
#export BACKEND_URL="http://$NODE2_IP:32002"
export BACKEND_URL="http://$NODE2_IP/api"

sed -i "s|<zenoh1-pv-path>|$PV_ZENOH_1|g" ./k8s/zenoh1/zenoh1-claim0-persistentvolumeclaim.yaml
sed -i "s|<node-name>|$NODE_NAME_1|g" ./k8s/zenoh1/zenoh1-claim0-persistentvolumeclaim.yaml

sed -i "s|<zenoh4-pv-path>|$PV_ZENOH_4|g" ./k8s/zenoh4/zenoh4-claim0-persistentvolumeclaim.yaml
sed -i "s|<node-name>|$NODE_NAME_2|g" ./k8s/zenoh4/zenoh4-claim0-persistentvolumeclaim.yaml

sed -i "s|<backend-service-url>|$BACKEND_URL|g" ./k8s/frontend/frontend-deployment.yaml

sed -i "s|<node-name>|$NODE_NAME_1|g" k8s/frontend/frontend-deployment.yaml
sed -i "s|<node-name>|$NODE_NAME_1|g" k8s/backend/backend-deployment.yaml

sed -i "s|<ddm-backend-image>|$DDM_BACKEND_IMAGE|g" k8s/backend/backend-deployment.yaml
sed -i "s|<ddm-celery-image>|$DDM_CELERY_IMAGE|g" k8s/celery/celery-deployment.yaml
sed -i "s|<ddm-frontend-image>|$DDM_FRONTEND_IMAGE|g" k8s/frontend/frontend-deployment.yaml

# APPLY

kubectl create ns ddm

kubectl apply -f ./k8s/zenoh1 --recursive -n ddm
kubectl apply -f ./k8s/zenoh4 --recursive -n ddm
kubectl apply -f ./k8s/db --recursive -n ddm

kubectl wait --for=condition=Ready pods --all -n ddm --timeout=60m

#kubectl apply -f ./k8s --recursive -n ddm
kubectl apply -f ./k8s/backend --recursive -n ddm
kubectl apply -f ./k8s/frontend --recursive -n ddm
kubectl apply -f ./k8s/celery --recursive -n ddm
kubectl apply -f ./k8s/ollama --recursive -n ddm

watch kubectl get pods -n ddm

