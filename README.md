# FoundryVTT-Actor-Communicator
FoundryVTT Module giving players a way to organise and chat with contatcs and 'data' using a immersive communicator.

# This is very early in developement and very broken. ;)


## Developement
Uses a variation of https://gitlab.com/foundry-projects/foundry-pc/create-foundry-project with gulp watch copying the build into FoundryVTT user data instead of symlinking.

Currently this path is fixed within foundryconfig.json and needs to be changed for different devs.

In order to develope for this you need to and install nodejs/gulp globally and:
```
cd <module-dir>
npm install
gulp link # admin permissions needed on windows...
gulp watch
```
