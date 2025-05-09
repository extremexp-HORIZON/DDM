kubectl delete all --all -n ddm

PVS=$(kubectl get pv | grep ddm | awk '{print $1}')

for PV in $PVS; do
    kubectl patch pv $PV --type=json -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
    kubectl delete pv $PV --force --grace-period=0 &
done

kubectl delete pvc --all -n ddm
