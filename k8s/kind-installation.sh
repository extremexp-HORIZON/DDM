

kind delete cluster --name ddm
kind create cluster --config kind_config.yaml --name ddm

export PV_ZENOH_1=/zenoh1
export PV_ZENOH_4=/zenoh4
export NODE_NAME_1=ddm-worker
export NODE_NAME_2=ddm-worker2

NODE2_IP=$(kubectl get node $NODE_NAME_2 -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')
export BACKEND_URL="http://$NODE2_IP:32002"

cd ..

sed -i "s|<zenoh1-pv-path>|$PV_ZENOH_1|g" ./k8s/zenoh1/zenoh1-claim0-persistentvolumeclaim.yaml
sed -i "s|<node-name>|$NODE_NAME_1|g" ./k8s/zenoh1/zenoh1-claim0-persistentvolumeclaim.yaml

sed -i "s|<zenoh4-pv-path>|$PV_ZENOH_4|g" ./k8s/zenoh4/zenoh4-claim0-persistentvolumeclaim.yaml
sed -i "s|<node-name>|$NODE_NAME_2|g" ./k8s/zenoh4/zenoh4-claim0-persistentvolumeclaim.yaml

sed -i "s|<backend-service-url>|$BACKEND_URL|g" ./k8s/frontend/frontend-deployment.yaml

sed -i "s|<node-name>|$NODE_NAME_1|g" k8s/frontend/frontend-deployment.yaml
sed -i "s|<node-name>|$NODE_NAME_2|g" k8s/backend/backend-deployment.yaml

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

watch kubectl get pods -n ddm
