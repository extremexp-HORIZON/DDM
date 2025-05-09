# DDM
Decentralized Data Management for ExtremeXP


### Deployment

We deploy 2 zenoh nodes on two different servers (on the same kubernetes cluster):
 - zenoh1 (now on the .200 Intracom server)
 - zenoh4 (now on the .171 Intracom server)

Both zenoh nodes require a volume on the respective server. 

Volume of the zenoh1 node has to be the `DDM/zenoh1` directory and the volume of the zenoh4 node has to be the `DDM/zenoh4` directory.

We deploy using the script `cluster-installation.sh`. 
 - The script may need to be modified, to define the volume paths, if the deployment environement changes.
 - The script replaces some values on the manifest files (at this commit already replaced)

We completely uninstall using the `uninstall.sh` script.
